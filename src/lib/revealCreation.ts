import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type { Purchase } from "@/lib/userService";
import type { EnquiryMode, EnquiryStages, RevealerRelation } from "@/lib/types";
import { findUnusedPurchaseEntry } from "@/lib/purchaseSelection";

// Types

export interface CreateRevealParams {
  uid: string;
  enquiryId: string;
  mode: EnquiryMode;
  parentName: string;
  photos: string[];              // download URLs (already uploaded client-side)
  revealAtMs: number | null;     // null only for Bundle of Joy announcements
  revealTimezone: string | null;
  expectedPlan: "basic" | "premium" | "custom";
  dueDate: string | null;
  initialStages: EnquiryStages;
  // Announcement mode fields
  babyName: string | null;
  // Reveal mode fields
  babyNameGirl: string | null;
  babyNameBoy: string | null;
  revealerEmail: string | null;
  revealerRelation: RevealerRelation | null;
  revealerName: string | null;
}

export interface CreateRevealResult {
  enquiryId: string;
  consumedPurchaseId: string;
  consumedPlan: "basic" | "premium" | "custom";
  newStatus: "video_in_progress";
}

// Main transaction

/**
 * Atomically:
 *   1. Verify user has revealsAllowed > 0
 *   2. Find oldest unused completed purchase (revealEnquiryId === null)
 *   3. Decrement revealsAllowed, increment revealsCreated
 *   4. Attach enquiryId to that purchase
 *   5. Create the enquiry document (with denormalized plan field)
 *
 * Uses a Firestore transaction to prevent race conditions where two
 * simultaneous requests could both pass the "revealsAllowed > 0" check
 * before either one decrements.
 *
 * Throws on any failure - caller is responsible for orphaned-photo cleanup.
 */
export async function createRevealAndConsumeEntitlement(
  params: CreateRevealParams
): Promise<CreateRevealResult> {
  const {
    uid,
    enquiryId,
    mode,
    parentName,
    photos,
    revealAtMs,
    revealTimezone,
    expectedPlan,
    dueDate,
    initialStages,
    babyName,
    babyNameGirl,
    babyNameBoy,
    revealerEmail,
    revealerRelation,
    revealerName,
  } = params;

  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const enquiryRef = db.collection("enquiries").doc(enquiryId);

  const newStatus = "video_in_progress";

  return await db.runTransaction(async (tx) => {
    // 1. Read user doc
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw new Error("USER_NOT_FOUND");
    }
    const userData = userSnap.data() as {
      revealsAllowed?: number;
      revealsCreated?: number;
      purchases?: Purchase[];
      activePlan?: string;
      isDeleted?: boolean;
    };

    if (userData.isDeleted) {
      throw new Error("USER_DELETED");
    }

    const revealsAllowed = userData.revealsAllowed ?? 0;
    if (revealsAllowed <= 0) {
      throw new Error("NO_ENTITLEMENT");
    }

    // 2. Prefer an unused purchase from the plan the user most recently
    // activated. Fall back to the oldest unused purchase only when that plan
    // has no entitlement remaining.
    const purchases = [...(userData.purchases ?? [])];
    const target = findUnusedPurchaseEntry(
      purchases,
      userData.activePlan
    );

    if (!target) {
      // Data integrity issue - revealsAllowed says they can but no Purchase has
      // capacity. Bail rather than silently creating an untracked reveal.
      throw new Error("NO_UNUSED_PURCHASE");
    }

    // Capture the plan from the consumed purchase for denormalization onto enquiry.
    // This lets the admin panel show plan without a join. Falls back to null if
    // somehow the purchase has no plan field (shouldn't happen, but defensive).
    const consumedPlan = target.purchase.plan ?? null;
    if (!consumedPlan || consumedPlan !== expectedPlan) {
      throw new Error("ENTITLEMENT_CHANGED");
    }
    const isPaidAnnouncement =
      mode === "announcement" && consumedPlan === "premium";
    const storedRevealAt =
      isPaidAnnouncement || revealAtMs === null
        ? null
        : Timestamp.fromMillis(revealAtMs);
    const storedRevealTimezone = isPaidAnnouncement
      ? null
      : revealTimezone;
    const paymentReceivedAt = Timestamp.now();

    // 3 + 4. Update purchase array with enquiryId attached, decrement/increment counters
    purchases[target.index] = {
      ...purchases[target.index],
      revealEnquiryId: enquiryId,
    };

    tx.update(userRef, {
      purchases,
      revealsAllowed: revealsAllowed - 1,
      revealsCreated: (userData.revealsCreated ?? 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 5. Create the enquiry document
    //    Using Timestamp.fromMillis for revealAt because FieldValue.serverTimestamp()
    //    can't be used for a user-provided time, and it's not inside an array so
    //    Timestamp is fine here.
    tx.set(enquiryRef, {
      id: enquiryId,
      userId: uid,
      mode,
      parentName,
      plan: consumedPlan,           // denormalized for admin queries
      photos,
      photoCount: photos.length,
      revealAt: storedRevealAt,
      revealTimezone: storedRevealTimezone,
      partyEnabled: !isPaidAnnouncement,
      dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : null,
      stages: { ...initialStages, paymentReceived: paymentReceivedAt },
      guestCount: 0,
      genderStatus: "not_submitted",
      doctorTokenHash: null,
      stripeSessionId: target.purchase.stripeSessionId ?? null,
      stripePaymentIntentId: target.purchase.stripePaymentIntentId ?? null,
      amountTotal: target.purchase.amountPaid ?? null,
      paymentStatus: "completed",
      videoUrl: null,
      downloadUrl: null,
      streamUid: null,
      pendingStreamUid: null,
      videoUploadStatus: "idle",
      status: newStatus,
      // Mode-specific fields
      babyName,
      babyNameGirl,
      babyNameBoy,
      revealerEmail,
      revealerRelation,
      revealerName: revealerName?.trim() || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      enquiryId,
      consumedPurchaseId: target.purchase.purchaseId,
      consumedPlan,
      newStatus,
    };
  });
}
