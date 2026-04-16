export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "placeholder", {
  apiVersion: "2024-04-10",
});

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
    const { userId, plan } = session.metadata ?? {};
    const db = getFirebaseDb();
    await setDoc(doc(db, "enquiries", session.id), {
      userId,
      plan,
      status: "awaiting_doctor",
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent,
      amountTotal: session.amount_total,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return NextResponse.json({ received: true });
}
