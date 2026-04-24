import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";
import { getPlanById } from "@/lib/types";
import type { Purchase, PurchaseStatus } from "@/lib/userService";

// ─── Activate a Plan ────────────────────────────────────────

export interface ActivatePlanParams {
  uid: string;
  planId: "free" | "premium" | "custom";
  stripeSessionId: string | null;       // null for dev-mode / free
  stripePaymentIntentId: string | null; // null for dev-mode / free
  amountPaidCents: number;              // 0 for free
  currency: string;                     // e.g. "usd"
  status?: PurchaseStatus;              // default "completed"
}

/**
 * Add a Purchase entry to the user's Firestore doc and update entitlement fields.
 * Called by:
 *  - create-checkout route (dev mode, or for free plan)
 *  - Stripe webhook (prod mode, when payment confirmed)
 */
export async function activatePlan(params: ActivatePlanParams): Promise<Purchase> {
  const {
    uid,
    planId,
    stripeSessionId,
    stripePaymentIntentId,
    amountPaidCents,
    currency,
    status = "completed",
  } = params;

  const plan = getPlanById(planId);
  if (!plan) {
    throw new Error(`Unknown plan: ${planId}`);
  }

  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);

  // Idempotency: if we have a Stripe session ID, make sure we haven't already processed it
  if (stripeSessionId) {
    const existingSnap = await userRef.get();
    if (existingSnap.exists) {
      const existing = existingSnap.data();
      const existingPurchases: Purchase[] = existing?.purchases ?? [];
      if (existingPurchases.some((p) => p.stripeSessionId === stripeSessionId)) {
        // Already processed this Stripe session — return the existing purchase
        const found = existingPurchases.find((p) => p.stripeSessionId === stripeSessionId);
        if (found) return found;
      }
    }
  }

  const purchase: Purchase = {
    purchaseId: uuidv4(),
    plan: planId,
    purchasedAt: FieldValue.serverTimestamp() as unknown as null,
    // ^ NOTE: we claim this is Timestamp|null for the type — Firestore resolves it to a real Timestamp
    amountPaid: amountPaidCents,
    currency,
    stripeSessionId,
    stripePaymentIntentId,
    status,
    revealsGranted: plan.revealsGranted,
    revealEnquiryId: null,
  };

  // Atomically: push to purchases array, increment revealsAllowed, set activePlan
  await userRef.update({
    purchases: FieldValue.arrayUnion(purchase),
    revealsAllowed: FieldValue.increment(plan.revealsGranted),
    activePlan: planId,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return purchase;
}
