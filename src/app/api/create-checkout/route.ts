export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { verifyAuthHeader } from "@/lib/authServer";
import { getPlanById } from "@/lib/types";
import { activatePlan } from "@/lib/planActivation";

// ─── Stripe config detection ────────────────────────────────

function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return !!key && !key.startsWith("placeholder") && key.length > 10;
}

// ─── POST /api/create-checkout ──────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Verify the requesting user
    const session = await verifyAuthHeader(req.headers.get("Authorization"));
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in and try again." },
        { status: 401 }
      );
    }

    // 2. Parse body
    const body = await req.json().catch(() => null);
    const planId = body?.planId;
    if (!planId || !["free", "premium", "custom"].includes(planId)) {
      return NextResponse.json(
        { error: "Invalid plan. Must be 'free', 'premium', or 'custom'." },
        { status: 400 }
      );
    }

    const plan = getPlanById(planId);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found." }, { status: 400 });
    }

    // 3. Free plan OR Stripe not configured → activate directly (dev mode)
    if (plan.priceCents === 0 || !isStripeConfigured()) {
      const purchase = await activatePlan({
        uid: session.uid,
        planId: plan.id,
        stripeSessionId: null,
        stripePaymentIntentId: null,
        amountPaidCents: plan.priceCents,
        currency: "usd",
        status: "completed",
      });

      return NextResponse.json({
        success: true,
        devMode: true,
        purchaseId: purchase.purchaseId,
        plan: plan.id,
        message:
          plan.priceCents === 0
            ? "Free plan activated."
            : "Dev mode: plan activated without payment. Stripe integration pending.",
      });
    }

    // 4. Real Stripe checkout flow
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-04-10",
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    if (!appUrl) {
      return NextResponse.json(
        { error: "Server misconfigured: NEXT_PUBLIC_APP_URL missing." },
        { status: 500 }
      );
    }

    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: plan.priceCents,
            product_data: {
              name: `Virtual Gender Reveal — ${plan.name}`,
              description: plan.description,
            },
          },
          quantity: 1,
        },
      ],
      // Metadata is critical — the webhook uses this to know who bought what
      metadata: {
        uid: session.uid,
        planId: plan.id,
      },
      customer_email: session.email ?? undefined,
      success_url: `${appUrl}/dashboard?payment=success&plan=${plan.id}`,
      cancel_url: `${appUrl}/dashboard?payment=cancelled`,
    });

    return NextResponse.json({
      success: true,
      devMode: false,
      url: stripeSession.url,
      plan: plan.id,
    });
  } catch (err) {
    console.error("create-checkout error:", err);
    const msg = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
