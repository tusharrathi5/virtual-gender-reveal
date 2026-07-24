export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader } from "@/lib/authServer";
import { getAdminDb } from "@/lib/firebase-admin";
import type { Purchase } from "@/lib/userService";
import { findUnusedPurchaseEntry } from "@/lib/purchaseSelection";

export async function GET(req: NextRequest) {
  const session = await verifyAuthHeader(req.headers.get("Authorization"));
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const snap = await getAdminDb().collection("users").doc(session.uid).get();
  if (!snap.exists) {
    return NextResponse.json({ canCreate: false, activePlan: "none", revealsAllowed: 0 });
  }

  const user = snap.data() ?? {};
  const revealsAllowed = typeof user.revealsAllowed === "number" ? user.revealsAllowed : 0;
  const activePlan = typeof user.activePlan === "string" ? user.activePlan : "none";
  const nextPurchase = findUnusedPurchaseEntry(
    Array.isArray(user.purchases) ? (user.purchases as Purchase[]) : [],
    activePlan
  );
  const nextPlan = nextPurchase?.purchase.plan ?? null;
  const isDeleted = user.isDeleted === true;

  return NextResponse.json({
    canCreate: !isDeleted && revealsAllowed > 0 && nextPlan !== null,
    activePlan,
    nextPlan,
    revealsAllowed,
  });
}
