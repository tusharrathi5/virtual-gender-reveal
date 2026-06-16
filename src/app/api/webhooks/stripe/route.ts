export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { activatePlan } from "@/lib/planActivation";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "placeholder", {
  apiVersion: "2024-04-10",
});

function isSupportedPlan(planId: string | undefined): planId is "basic" | "premium" | "custom" {
  return planId === "basic" || planId === "premium" || planId === "custom";
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET ?? "placeholder"
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { uid, planId } = session.metadata ?? {};

    if (!uid || !isSupportedPlan(planId)) {
      return NextResponse.json({ error: "Missing or invalid checkout metadata" }, { status: 400 });
    }

    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true, paymentStatus: session.payment_status });
    }

    await activatePlan({
      uid,
      planId,
      stripeSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      amountPaidCents: session.amount_total ?? 0,
      currency: session.currency ?? "usd",
      status: "completed",
    });
  }

  return NextResponse.json({ received: true });
}
