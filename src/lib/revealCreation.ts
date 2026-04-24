import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type { Purchase } from "@/lib/userService";
import type { EnquiryMode, EnquiryStages, RevealerRelation } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────

export interface CreateRevealParams {
  uid: string;
  enquiryId: string;
  mode: EnquiryMode;
  parentName: string;
  photos: string[];              // download URLs (already uploaded client-side)
  revealAtMs: number;            // parent-provided reveal time as epoch ms
  revealTimezone: string;
  initialStages: EnquiryStages;
  // Announcement mode fields
  babyName: string | null;
  // Reveal mode fields
  babyNameGirl: string | null;
  babyNameBoy: string | null;
  revealerEmail: string | null;
  revealerRelation: RevealerRelation | null;
}

export interface CreateRevealResult {
  enquiryId: string;
  consumedPurchaseId: string;
  newStatus: "awaiting_revealer" | "video_ready";
}

// ─── Main transaction ───────────────────────────────────────

/**
 * Atomically:
 *   1. Verify user has revealsAllowed > 0
 *   2. Find oldest unused completed purchase (revealEnquiryId === null)
 *   3. Decrement revealsAllowed, increment revealsCreated
 *   4. Attach enquiryId to that purchase
 *   5. Create the enquiry document
 *
 * Uses a Firestore transaction to prevent race conditions where two
 * simultaneous requests could both pass the "revealsAllowed > 0" check
 * before either one decrements.
 *
 * Throws on any failure — caller is responsible for orphaned-photo cleanup.
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
    initialStages,
    babyName,
    babyNameGirl,
    babyNameBoy,
    revealerEmail,
    revealerRelation,
  } = params;

  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const enquiryRef = db.collection("enquiries").doc(enquiryId);

  const newStatus = mode === "reveal" ? "awaiting_revealer" : "video_ready";

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
      isDeleted?: boolean;
    };

    if (userData.isDeleted) {
      throw new Error("USER_DELETED");
    }

    const revealsAllowed = userData.revealsAllowed ?? 0;
    if (revealsAllowed <= 0) {
      throw new Error("NO_ENTITLEMENT");
    }

    // 2. Find oldest unused completed purchase
    const purchases = [...(userData.purchases ?? [])];
    const sortedIndexes = purchases
      .map((p, idx) => ({ p, idx }))
      .sort((a, b) => {
        const ta = a.p.purchasedAt?.toMillis?.() ?? 0;
        const tb = b.p.purchasedAt?.toMillis?.() ?? 0;
        return ta - tb;
      });

    const target = sortedIndexes.find(
      ({ p }) =>
        p.status === "completed" &&
        p.revealEnquiryId === null &&
        p.revealsGranted > 0
    );

    if (!target) {
      // Data integrity issue — revealsAllowed says they can but no Purchase has
      // capacity. Bail rather than silently creating an untracked reveal.
      throw new Error("NO_UNUSED_PURCHASE");
    }

    // 3 + 4. Update purchase array with enquiryId attached, decrement/increment counters
    purchases[target.idx] = {
      ...purchases[target.idx],
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
      photos,
      photoCount: photos.length,
      revealAt: Timestamp.fromMillis(revealAtMs),
      revealTimezone,
      stages: initialStages,
      guestCount: 0,
      genderStatus: "not_submitted",
      doctorTokenHash: null,
      stripeSessionId: null,
      stripePaymentIntentId: null,
      amountTotal: null,
      status: newStatus,
      // Mode-specific fields
      babyName,
      babyNameGirl,
      babyNameBoy,
      revealerEmail,
      revealerRelation,
      revealerName: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      enquiryId,
      consumedPurchaseId: target.p.purchaseId,
      newStatus,
    };
  });
}
