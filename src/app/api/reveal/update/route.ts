export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import CryptoJS from "crypto-js";
import { verifyAuthHeader } from "@/lib/authServer";
import { getAdminDb } from "@/lib/firebase-admin";
import { generateDoctorToken } from "@/lib/doctorToken";
import { sendDoctorInviteEmail } from "@/lib/resendEmail";
import { deleteSecureGender, saveGender } from "@/lib/secureGenderService";
import {
  PHOTO_MAX,
  type EnquiryMode,
  type GenderValue,
  type RevealerRelation,
} from "@/lib/types";

interface UpdateRevealBody {
  enquiryId?: string;
  mode?: EnquiryMode;
  parentName?: string;
  photos?: string[];
  revealAtMs?: number;
  revealTimezone?: string;
  dueDate?: string | null;
  babyName?: string | null;
  announcementGender?: GenderValue;
  babyNameGirl?: string | null;
  babyNameBoy?: string | null;
  revealerEmail?: string;
  revealerRelation?: RevealerRelation;
  revealerName?: string;
}

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function relationToLabel(relation: RevealerRelation): string {
  switch (relation) {
    case "doctor":
      return "doctor or midwife";
    case "relative":
      return "relative";
    case "friend":
      return "friend";
    default:
      return "trusted contact";
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

function validateInput(
  body: UpdateRevealBody,
  existingRevealAt: Date | null,
  previousMode: EnquiryMode
): string | null {
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
  } = body;

  if (!enquiryId || typeof enquiryId !== "string") return "Missing or invalid enquiryId.";
  if (mode !== "reveal" && mode !== "announcement") return "Mode must be 'reveal' or 'announcement'.";
  if (!parentName || typeof parentName !== "string" || !parentName.trim()) return "Parent name is required.";
  if (!Array.isArray(photos) || photos.length > PHOTO_MAX) {
    return `Please include no more than ${PHOTO_MAX} photos.`;
  }
  if (photos.some((url) => typeof url !== "string" || !/^https?:\/\//.test(url))) {
    return "Invalid photo URL format.";
  }

  if (typeof revealAtMs !== "number" || Number.isNaN(revealAtMs)) return "Invalid reveal time.";
  const previousMs = existingRevealAt?.getTime() ?? 0;
  const revealTimeChanged = Math.abs(previousMs - revealAtMs) > 60 * 1000;
  if (revealTimeChanged && revealAtMs < Date.now() + 30 * 60 * 1000) {
    return "Reveal time must be at least 30 minutes in the future.";
  }

  if (!revealTimezone || typeof revealTimezone !== "string") return "Timezone is required.";

  if (mode === "announcement") {
    if (previousMode !== "announcement" && announcementGender !== "boy" && announcementGender !== "girl") {
      return "Please select the baby's gender when switching to announcement mode.";
    }
    if (announcementGender && announcementGender !== "boy" && announcementGender !== "girl") {
      return "Please select a valid gender.";
    }
  } else {
    if (!revealerName || typeof revealerName !== "string" || !revealerName.trim()) {
      return "Revealer's name is required.";
    }
    if (
      !revealerEmail ||
      typeof revealerEmail !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(revealerEmail.trim())
    ) {
      return "Please provide a valid revealer email.";
    }
    if (!["doctor", "relative", "friend", "other"].includes(revealerRelation as string)) {
      return "Please select the revealer's relation.";
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  const session = await verifyAuthHeader(req.headers.get("Authorization"));
  if (!session) {
    return NextResponse.json({ error: "Unauthorized. Please sign in and try again." }, { status: 401 });
  }

  const body: UpdateRevealBody | null = await req.json().catch(() => null);
  if (!body?.enquiryId) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const db = getAdminDb();
  const enquiryRef = db.collection("enquiries").doc(body.enquiryId.trim());
  const enquirySnap = await enquiryRef.get();
  if (!enquirySnap.exists) return NextResponse.json({ error: "Reveal not found." }, { status: 404 });

  const existing = enquirySnap.data() as Record<string, unknown>;
  if (existing.userId !== session.uid) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const createdAt = toDate(existing.createdAt);
  if (!createdAt || Date.now() - createdAt.getTime() > EDIT_WINDOW_MS) {
    return NextResponse.json(
      { error: "Reveal details can only be edited during the first 24 hours after creation." },
      { status: 403 }
    );
  }

  const previousMode: EnquiryMode = existing.mode === "announcement" ? "announcement" : "reveal";
  const existingRevealAt = toDate(existing.revealAt);


  const validationError = validateInput(body, existingRevealAt, previousMode);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const nextMode = body.mode!;
  const nextParentName = body.parentName!.trim();
  const nextPhotos = body.photos ?? [];
  const nextRevealAt = Timestamp.fromMillis(body.revealAtMs!);
  const nextTimezone = body.revealTimezone!.trim();

  const update: Record<string, unknown> = {
    mode: nextMode,
    parentName: nextParentName,
    photos: nextPhotos,
    photoCount: nextPhotos.length,
    revealAt: nextRevealAt,
    revealTimezone: nextTimezone,
    dueDate: body.dueDate?.trim() ? Timestamp.fromDate(new Date(body.dueDate.trim())) : null,
    revealerName: nextMode === "reveal" ? (body.revealerName?.trim() || null) : null,
    updatedAt: FieldValue.serverTimestamp(),
  };

  let revealerEmailSent = false;

  if (nextMode === "announcement") {
    update.babyName = null;
    update.babyNameGirl = null;
    update.babyNameBoy = null;
    update.revealerEmail = null;
    update.revealerRelation = null;
    update.revealerName = null;
    update.doctorTokenHash = null;
    if (existing.status === "awaiting_revealer") update.status = "video_ready";

    if (body.announcementGender) {
      await saveGender({
        enquiryId: body.enquiryId.trim(),
        gender: body.announcementGender,
        submittedBy: "parent",
        submittedByUid: session.uid,
      });
      update.genderStatus = "submitted";
      update["stages.revealerSubmitted"] = null;

      // Handle basic plan video URL updates
      if (existing.plan === "basic") {
        update.videoUrl = `https://firebasestorage.googleapis.com/v0/b/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/o/static%2Fvideos%2F${body.announcementGender}_reveal.mov?alt=media`;
        update.status = "completed";
      }
    }
  } else {
    const nextEmail = body.revealerEmail!.trim().toLowerCase();
    const nextRelation = body.revealerRelation!;
    update.babyName = null;
    update.babyNameGirl = null;
    update.babyNameBoy = null;
    update.revealerEmail = nextEmail;
    update.revealerRelation = nextRelation;

    const previousEmail = typeof existing.revealerEmail === "string" ? existing.revealerEmail : "";
    const revealerEmailChanged = previousMode !== "reveal" || previousEmail.toLowerCase() !== nextEmail;

    if (previousMode === "announcement") {
      await deleteSecureGender(body.enquiryId.trim()).catch(() => {});
      update.genderStatus = "not_submitted";
      update.status = "awaiting_revealer";
    }

    if (revealerEmailChanged && existing.genderStatus === "submitted") {
      await deleteSecureGender(body.enquiryId.trim()).catch(() => {});
      update.genderStatus = "not_submitted";
      update.genderEncrypted = FieldValue.delete();
      update.doctorConfirmedAt = FieldValue.delete();
      update["stages.revealerSubmitted"] = null;
      update.status = "awaiting_revealer";
    }

    const shouldSendRevealerLink =
      revealerEmailChanged ||
      existing.genderStatus !== "submitted";

    if (shouldSendRevealerLink) {
      const token = generateDoctorToken(body.enquiryId.trim());
      const tokenHash = CryptoJS.SHA256(token).toString();
      update.doctorTokenHash = tokenHash;
      update["stages.revealerLinkSent"] = FieldValue.serverTimestamp();

      try {
        const revealUrl = `${getAppUrl(req)}/doctor/${encodeURIComponent(token)}`;
        await sendDoctorInviteEmail({
          to: nextEmail,
          parentName: nextParentName,
          relationLabel: relationToLabel(nextRelation),
          revealUrl,
          enquiryId: body.enquiryId.trim(),
          revealerName: (body.revealerName || "").trim() || undefined,
        });
        revealerEmailSent = true;
      } catch (err) {
        const details = err instanceof Error ? err.message : String(err);
        console.error(`[reveal/update] Failed to send revealer invite for ${body.enquiryId}: ${details}`);
      }
    }
  }

  await enquiryRef.update(update);

  return NextResponse.json({
    success: true,
    enquiryId: body.enquiryId.trim(),
    revealerEmailSent,
  });
}
