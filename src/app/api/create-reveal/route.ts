export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader } from "@/lib/authServer";
import { createRevealAndConsumeEntitlement } from "@/lib/revealCreation";
import { saveGender } from "@/lib/secureGenderService";
import { generateDoctorToken } from "@/lib/doctorToken";
import CryptoJS from "crypto-js";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendDoctorInviteEmail } from "@/lib/resendEmail";
import { deleteEnquiryPhotosAdmin } from "@/lib/storageServiceAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  INITIAL_STAGES,
  PHOTO_MAX,
  type EnquiryMode,
  type GenderValue,
  type RevealerRelation,
} from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────

interface CreateRevealBody {
  enquiryId?: string;
  mode?: EnquiryMode;
  parentName?: string;
  photos?: string[];
  revealAtMs?: number;
  revealTimezone?: string;
  dueDate?: string | null;
  // Announcement mode
  babyName?: string | null;
  announcementGender?: GenderValue;
  // Reveal mode
  babyNameGirl?: string | null;
  babyNameBoy?: string | null;
  revealerEmail?: string;
  revealerRelation?: RevealerRelation;
}



function relationToLabel(relation: RevealerRelation): string {
  switch (relation) {
    case "doctor": return "doctor or midwife";
    case "relative": return "relative";
    case "friend": return "friend";
    default: return "trusted contact";
  }
}

function getAppUrl(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const origin = req.headers.get("origin")?.trim();
  if (origin) return origin.replace(/\/$/, "");

  const host = req.headers.get("host")?.trim();
  if (host) {
    const protocol = host.includes("localhost") ? "http" : "https";
    return `${protocol}://${host}`;
  }

  throw new Error("APP_URL_UNAVAILABLE");
}

// ─── POST /api/create-reveal ────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Verify auth
  const session = await verifyAuthHeader(req.headers.get("Authorization"));
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized. Please sign in and try again." },
      { status: 401 }
    );
  }

  // 2. Parse body
  const body: CreateRevealBody | null = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const {
    enquiryId,
    mode,
    parentName,
    photos,
    revealAtMs,
    revealTimezone,
    dueDate,
    babyName,
    announcementGender,
    babyNameGirl,
    babyNameBoy,
    revealerEmail,
    revealerRelation,
    revealerName,
  } = body;

  const parsedRevealAtMs = revealAtMs;

  const userSnap = await getAdminDb().collection("users").doc(session.uid).get();
  const plan = userSnap.data()?.activePlan ?? "basic";

  // 3. Validate — bail early, no Firestore writes yet
  const validationError = validateCreateRevealInput({
    enquiryId,
    mode,
    parentName,
    photos,
    revealAtMs: parsedRevealAtMs,
    revealTimezone,
    announcementGender,
    revealerEmail,
    revealerRelation,
    revealerName,
    plan,
  });
  if (validationError) {
    // Photos may already be in Storage — clean them up since we're rejecting
    if (enquiryId && photos && photos.length > 0) {
      await deleteEnquiryPhotosAdmin(enquiryId).catch((err) => {
        console.error(
          `[create-reveal] Photo cleanup failed for rejected request ${enquiryId}:`,
          err
        );
      });
    }
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // At this point all fields are validated and non-null — TypeScript doesn't
  // track this through the validator, so we re-assert with `!`.
  const validatedMode = mode!;
  const validatedEnquiryId = enquiryId!;
  const validatedPhotos = photos!;
  const validatedParentName = parentName!.trim();

  // 4. Run the atomic transaction
  try {
    const result = await createRevealAndConsumeEntitlement({
      uid: session.uid,
      enquiryId: validatedEnquiryId,
      mode: validatedMode,
      parentName: validatedParentName,
      photos: validatedPhotos,
      revealAtMs: parsedRevealAtMs!,
      revealTimezone: revealTimezone!,
      dueDate: dueDate?.trim() || null,
      initialStages: INITIAL_STAGES,
      babyName: validatedMode === "announcement" ? (babyName?.trim() || null) : null,
      babyNameGirl: validatedMode === "reveal" ? (babyNameGirl?.trim() || null) : null,
      babyNameBoy: validatedMode === "reveal" ? (babyNameBoy?.trim() || null) : null,
      revealerEmail: validatedMode === "reveal" ? revealerEmail!.trim().toLowerCase() : null,
      revealerRelation: validatedMode === "reveal" ? revealerRelation! : null,
      revealerName: validatedMode === "reveal" ? (revealerName?.trim() || null) : null,
    });

    // 5. Announcement mode — encrypt + save the known gender
    //    We do this AFTER the transaction so we're not blocking the transaction
    //    on encryption work, and because secure-genders is a separate collection
    //    that doesn't need to be atomic with the enquiry creation.
    if (validatedMode === "reveal") {
      const token = generateDoctorToken(validatedEnquiryId);
      const tokenHash = CryptoJS.SHA256(token).toString();
      const appUrl = getAppUrl(req);

      await getAdminDb().collection("enquiries").doc(validatedEnquiryId).update({
        doctorTokenHash: tokenHash,
      });

      const revealUrl = `${appUrl}/doctor/${encodeURIComponent(token)}`;
      let revealerEmailSent = true;
      try {
        await sendDoctorInviteEmail({
          to: revealerEmail!.trim().toLowerCase(),
          parentName: validatedParentName,
          relationLabel: relationToLabel(revealerRelation!),
          revealUrl,
          enquiryId: validatedEnquiryId,
          revealerName: (revealerName || "").trim() || undefined,
        });
      } catch (emailErr) {
        revealerEmailSent = false;
        const details = emailErr instanceof Error ? emailErr.message : String(emailErr);
        console.error(`[create-reveal] Failed to send doctor invite for ${validatedEnquiryId}: ${details}`);
      }

      return NextResponse.json({
        success: true,
        enquiryId: result.enquiryId,
        status: result.newStatus,
        consumedPurchaseId: result.consumedPurchaseId,
        revealerEmailSent,
      });
    }

    if (validatedMode === "announcement" && announcementGender) {
      try {
        await saveGender({
          enquiryId: validatedEnquiryId,
          gender: announcementGender,
          submittedBy: "parent",
          submittedByUid: session.uid,
        });
      } catch (genderErr) {
        // Enquiry was created + entitlement was consumed, but gender save failed.
        // Log loudly — this is a data-integrity issue that needs manual intervention.
        console.error(
          `[create-reveal] CRITICAL: Enquiry ${validatedEnquiryId} created but gender save failed:`,
          genderErr
        );
        // We don't undo the reveal creation — the user's entitlement is consumed,
        // but the enquiry exists. Better to have the user contact support than
        // to silently refund and have a half-baked enquiry floating around.
        return NextResponse.json(
          {
            error: "Your reveal was created, but we couldn't save the gender securely. Please contact support.",
            enquiryId: validatedEnquiryId,
          },
          { status: 500 }
        );
      }
    }

    const enquiryRef = getAdminDb().collection("enquiries").doc(validatedEnquiryId);
    const enquirySnap = await enquiryRef.get();
    const plan = enquirySnap.data()?.plan;

    if (plan === "basic" && validatedMode === "announcement" && announcementGender) {
      const videoUrl = `https://firebasestorage.googleapis.com/v0/b/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/o/static%2Fvideos%2F${announcementGender}_reveal.mov?alt=media`;
      await enquiryRef.update({
        videoUrl,
        status: "completed",
        "stages.videoGenerated": Timestamp.now(),
      });
    }

    return NextResponse.json({
      success: true,
      enquiryId: result.enquiryId,
      status: result.newStatus,
      consumedPurchaseId: result.consumedPurchaseId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // Clean up orphaned photos since the reveal wasn't created
    await deleteEnquiryPhotosAdmin(validatedEnquiryId).catch((cleanupErr) => {
      console.error(
        `[create-reveal] Photo cleanup failed after transaction error for ${validatedEnquiryId}:`,
        cleanupErr
      );
    });

    // Map known errors to clean user messages
    if (message === "USER_NOT_FOUND") {
      return NextResponse.json(
        { error: "User account not found. Please sign out and back in." },
        { status: 404 }
      );
    }
    if (message === "USER_DELETED") {
      return NextResponse.json(
        { error: "Account is deleted." },
        { status: 403 }
      );
    }
    if (message === "NO_ENTITLEMENT" || message === "NO_UNUSED_PURCHASE") {
      return NextResponse.json(
        { error: "You don't have any reveals remaining. Please purchase a plan first." },
        { status: 403 }
      );
    }

    console.error("[create-reveal] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to create reveal. Please try again." },
      { status: 500 }
    );
  }
}

// ─── Validation ─────────────────────────────────────────────

function validateCreateRevealInput(input: {
  enquiryId?: string;
  mode?: EnquiryMode;
  parentName?: string;
  photos?: string[];
  revealAtMs?: number;
  revealTimezone?: string;
  dueDate?: string | null;
  announcementGender?: GenderValue;
  revealerEmail?: string;
  revealerRelation?: RevealerRelation;
  revealerName?: string;
  plan?: string;
}): string | null {
  const {
    enquiryId,
    mode,
    parentName,
    photos,
    revealAtMs,
    revealTimezone,
    announcementGender,
    revealerEmail,
    revealerRelation,
    revealerName,
    plan,
  } = input;

  // Basic presence checks
  if (!enquiryId || typeof enquiryId !== "string") {
    return "Missing or invalid enquiryId.";
  }
  if (mode !== "reveal" && mode !== "announcement") {
    return "Mode must be 'reveal' or 'announcement'.";
  }
  if (!parentName || typeof parentName !== "string" || !parentName.trim()) {
    return "Parent name is required.";
  }
  if (!Array.isArray(photos) || photos.length > PHOTO_MAX) {
    return `Please include no more than ${PHOTO_MAX} photos.`;
  }
  if (photos.some((url) => typeof url !== "string" || !/^https?:\/\//.test(url))) {
    return "Invalid photo URL format.";
  }
  if (typeof revealAtMs !== "number" || isNaN(revealAtMs)) {
    return "Invalid reveal time.";
  }
  if (plan !== "basic") {
    if (revealAtMs < Date.now() + 30 * 60 * 1000) {
      return "Reveal time must be at least 30 minutes in the future.";
    }
  }
  if (!revealTimezone || typeof revealTimezone !== "string") {
    return "Timezone is required.";
  }

  // Mode-specific
  if (mode === "announcement") {
    if (announcementGender !== "boy" && announcementGender !== "girl") {
      return "Please select the baby's gender.";
    }
  } else {
    if (!revealerName || typeof revealerName !== "string" || !revealerName.trim()) {
      return "Revealer's name is required.";
    }
    if (!revealerEmail || typeof revealerEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(revealerEmail.trim())) {
      return "Please provide a valid revealer email.";
    }
    if (!["doctor", "relative", "friend", "other"].includes(revealerRelation as string)) {
      return "Please select the revealer's relation.";
    }
  }

  return null;
}
