export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { verifyAuthHeader } from "@/lib/authServer";
import { activatePlan } from "@/lib/planActivation";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "placeholder", {
  apiVersion: "2024-04-10",
});

function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return !!key && !key.startsWith("placeholder") && key.length > 10;
}

function isSupportedPlan(planId: string | undefined): planId is "basic" | "premium" | "custom" {
  return planId === "basic" || planId === "premium" || planId === "custom";
}

export async function GET(req: NextRequest) {
  const session = await verifyAuthHeader(req.headers.get("Authorization"));
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
  }

  const checkoutSessionId = req.nextUrl.searchParams.get("session_id");
  if (!checkoutSessionId) {
    return NextResponse.json({ error: "Missing checkout session id." }, { status: 400 });
  }

  const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);
  const { uid, planId } = checkoutSession.metadata ?? {};

  if (uid !== session.uid || !isSupportedPlan(planId)) {
    return NextResponse.json({ error: "Checkout session does not belong to this user." }, { status: 403 });
  }

  if (checkoutSession.payment_status === "paid") {
    await activatePlan({
      uid,
      planId,
      stripeSessionId: checkoutSession.id,
      stripePaymentIntentId:
        typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : null,
      amountPaidCents: checkoutSession.amount_total ?? 0,
      currency: checkoutSession.currency ?? "usd",
      status: "completed",
    });
  }

  return NextResponse.json({
    status: checkoutSession.status,
    paymentStatus: checkoutSession.payment_status,
    plan: planId,
  });
}
