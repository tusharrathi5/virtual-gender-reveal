import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";
import { getPlanById } from "@/lib/types";
import type { Purchase, PurchaseStatus } from "@/lib/userService";

export interface ActivatePlanParams {
  uid: string;
  planId: "basic" | "premium" | "custom";
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  amountPaidCents: number;
  currency: string;
  status?: PurchaseStatus;
}

/**
 * Adds a purchase and entitlement exactly once per Stripe session/payment intent.
 * Stripe webhooks call this as the payment source of truth; checkout-status uses
 * the same function only after Stripe itself reports the session is paid.
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

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new Error("USER_NOT_FOUND");

    const data = snap.data() as { purchases?: Purchase[] };
    const purchases = [...(data.purchases ?? [])];
    const existing = purchases.find((purchase) => {
      if (stripeSessionId && purchase.stripeSessionId === stripeSessionId) return true;
      if (stripePaymentIntentId && purchase.stripePaymentIntentId === stripePaymentIntentId) return true;
      return false;
    });
    if (existing) return existing;

    const purchase: Purchase = {
      purchaseId: uuidv4(),
      plan: planId,
      purchasedAt: Timestamp.now() as unknown as Purchase["purchasedAt"],
      amountPaid: amountPaidCents,
      currency,
      stripeSessionId,
      stripePaymentIntentId,
      status,
      revealsGranted: plan.revealsGranted,
      revealEnquiryId: null,
    };

    purchases.push(purchase);
    tx.update(userRef, {
      purchases,
      revealsAllowed: FieldValue.increment(plan.revealsGranted),
      activePlan: planId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return purchase;
  });
}
