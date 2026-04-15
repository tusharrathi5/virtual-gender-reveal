export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "placeholder", {
  apiVersion: "2024-04-10",
});

export async function POST(req: NextRequest) {
  try {
    const { plan, userId } = await req.json();

    const PRICES: Record<string, number> = {
      free: 0,
      premium: 19900,
      custom: 65000,
    };

    const amount = PRICES[plan];
    if (amount === undefined) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    if (amount === 0) {
      return NextResponse.json({ free: true });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: {
              name: `Virtual Gender Reveal — ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
              description: "Your reveal experience, crafted for moments that matter.",
            },
          },
          quantity: 1,
        },
      ],
      metadata: { userId, plan },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/#pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    return NextResponse.json({ error: "Payment failed" }, { status: 500 });
  }
}
