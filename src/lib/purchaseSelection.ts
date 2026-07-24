import type { ActivePlan, Purchase } from "@/lib/userService";

export type UnusedPurchaseEntry = {
  purchase: Purchase;
  index: number;
};

/**
 * Select an unused entitlement from the plan the user most recently activated.
 * This ensures that buying Bundle of Joy and continuing directly to creation
 * consumes that paid purchase instead of an older unused Little Bundle.
 */
export function findUnusedPurchaseEntry(
  purchases: Purchase[],
  activePlan: ActivePlan | string | null | undefined
): UnusedPurchaseEntry | null {
  const unused = purchases
    .map((purchase, index) => ({ purchase, index }))
    .filter(
      ({ purchase }) =>
        purchase.status === "completed" &&
        purchase.revealEnquiryId === null &&
        purchase.revealsGranted > 0
    )
    .sort((a, b) => {
      const aTime = a.purchase.purchasedAt?.toMillis?.() ?? 0;
      const bTime = b.purchase.purchasedAt?.toMillis?.() ?? 0;
      return aTime - bTime;
    });

  const activePlanPurchase = unused.find(
    ({ purchase }) => purchase.plan === activePlan
  );
  return activePlanPurchase ?? unused[0] ?? null;
}
