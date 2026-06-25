#!/usr/bin/env node

import process from "node:process";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import admin from "firebase-admin";

const SUPPORTED_PLANS = {
  basic: { revealsGranted: 1 },
  premium: { revealsGranted: 1 },
  custom: { revealsGranted: 1 },
};

function usage(exitCode = 1) {
  console.log(`Usage:
  node scripts/reconcile-stripe-payment.mjs --session cs_... [--email user@example.com] [--uid firebaseUid] [--reveal enquiryId | --latest-reveal] [--apply]

Dry-run is the default. Add --apply only after reviewing the verified mapping.`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    apply: false,
    latestReveal: false,
    session: null,
    email: null,
    uid: null,
    reveal: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--latest-reveal") {
      args.latestReveal = true;
    } else if (arg === "--session") {
      args.session = argv[++i] ?? null;
    } else if (arg === "--email") {
      args.email = argv[++i]?.toLowerCase() ?? null;
    } else if (arg === "--uid") {
      args.uid = argv[++i] ?? null;
    } else if (arg === "--reveal") {
      args.reveal = argv[++i] ?? null;
    } else if (arg === "--help" || arg === "-h") {
      usage(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.session) throw new Error("Missing --session.");
  if (args.reveal && args.latestReveal) throw new Error("Use either --reveal or --latest-reveal, not both.");
  return args;
}

function initFirebaseAdmin() {
  if (admin.apps.length > 0) return;

  const serviceAccount = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
    return;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin SDK not configured. Set FIREBASE_ADMIN_SERVICE_ACCOUNT or FIREBASE_ADMIN_* env vars."
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

function assertSupportedPlan(planId) {
  if (!Object.prototype.hasOwnProperty.call(SUPPORTED_PLANS, planId)) {
    throw new Error(`Unsupported or missing Stripe metadata planId: ${planId ?? "<missing>"}`);
  }
  return planId;
}

function getSessionPaymentIntentId(session) {
  return typeof session.payment_intent === "string" ? session.payment_intent : null;
}

function findExistingPurchaseIndex(purchases, sessionId, paymentIntentId) {
  return purchases.findIndex((purchase) => {
    if (sessionId && purchase.stripeSessionId === sessionId) return true;
    if (paymentIntentId && purchase.stripePaymentIntentId === paymentIntentId) return true;
    return false;
  });
}

async function resolveLatestRevealId(db, uid) {
  const snap = await db
    .collection("enquiries")
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  return snap.empty ? null : snap.docs[0].id;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    usage(1);
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || stripeKey.startsWith("placeholder")) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  initFirebaseAdmin();
  const db = admin.firestore();
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" });

  const session = await stripe.checkout.sessions.retrieve(args.session);
  const metadata = session.metadata ?? {};
  const uid = metadata.uid;
  const planId = assertSupportedPlan(metadata.planId);
  const paymentIntentId = getSessionPaymentIntentId(session);

  if (!uid) throw new Error("Stripe Checkout Session is missing metadata.uid; refusing to reconcile.");
  if (args.uid && args.uid !== uid) {
    throw new Error(`Provided --uid does not match Stripe metadata.uid (${uid}).`);
  }
  if (session.payment_status !== "paid") {
    console.log("Stripe does not report this Checkout Session as paid. No changes made.");
    console.log(JSON.stringify({ sessionId: session.id, status: session.status, paymentStatus: session.payment_status }, null, 2));
    return;
  }

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new Error(`No Firebase user document found for uid ${uid}.`);
  const userData = userSnap.data() ?? {};
  const userEmail = typeof userData.email === "string" ? userData.email.toLowerCase() : null;
  if (args.email && userEmail !== args.email) {
    throw new Error(`Provided --email does not match Firebase user email (${userEmail ?? "<missing>"}).`);
  }

  const revealId = args.latestReveal ? await resolveLatestRevealId(db, uid) : args.reveal;
  if (args.latestReveal && !revealId) throw new Error(`No reveal found for uid ${uid}.`);

  const revealRef = revealId ? db.collection("enquiries").doc(revealId) : null;
  if (revealRef) {
    const revealSnap = await revealRef.get();
    if (!revealSnap.exists) throw new Error(`Reveal ${revealId} does not exist.`);
    const revealUserId = revealSnap.get("userId");
    if (revealUserId !== uid) {
      throw new Error(`Reveal ${revealId} belongs to ${revealUserId}, not Stripe metadata.uid ${uid}.`);
    }
  }

  const purchases = Array.isArray(userData.purchases) ? userData.purchases : [];
  const existingIndex = findExistingPurchaseIndex(purchases, session.id, paymentIntentId);
  const existingPurchase = existingIndex >= 0 ? purchases[existingIndex] : null;

  const mapping = {
    stripeSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
    stripePaymentStatus: session.payment_status,
    stripeStatus: session.status,
    metadataUid: uid,
    firebaseUserEmail: userEmail,
    metadataPlanId: planId,
    revealId: revealId ?? null,
    existingPurchaseId: existingPurchase?.purchaseId ?? null,
    existingPurchaseStatus: existingPurchase?.status ?? null,
    apply: args.apply,
  };

  console.log("Verified Stripe/Firebase mapping:");
  console.log(JSON.stringify(mapping, null, 2));

  if (!args.apply) {
    console.log("Dry run only. Re-run with --apply to update Firebase.");
    return;
  }

  const plan = SUPPORTED_PLANS[planId];
  const amountPaid = session.amount_total ?? 0;
  const currency = session.currency ?? "usd";

  await db.runTransaction(async (tx) => {
    const freshUserSnap = await tx.get(userRef);
    if (!freshUserSnap.exists) throw new Error(`No Firebase user document found for uid ${uid}.`);
    const freshUser = freshUserSnap.data() ?? {};
    const nextPurchases = Array.isArray(freshUser.purchases) ? [...freshUser.purchases] : [];
    const nextExistingIndex = findExistingPurchaseIndex(nextPurchases, session.id, paymentIntentId);
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const targetRevealId = revealId ?? null;
    const updates = {
      activePlan: planId,
      purchases: nextPurchases,
      updatedAt: serverTimestamp,
    };

    if (nextExistingIndex >= 0) {
      const current = nextPurchases[nextExistingIndex];
      const wasCompleted = current.status === "completed";
      const wasUnlinked = current.revealEnquiryId === null || current.revealEnquiryId === undefined || current.revealEnquiryId === "";
      nextPurchases[nextExistingIndex] = {
        ...current,
        plan: current.plan ?? planId,
        amountPaid: current.amountPaid ?? amountPaid,
        currency: current.currency ?? currency,
        stripeSessionId: current.stripeSessionId ?? session.id,
        stripePaymentIntentId: current.stripePaymentIntentId ?? paymentIntentId,
        status: "completed",
        revealsGranted: current.revealsGranted ?? plan.revealsGranted,
        revealEnquiryId: targetRevealId ?? current.revealEnquiryId ?? null,
      };

      if (!wasCompleted && !targetRevealId) {
        updates.revealsAllowed = admin.firestore.FieldValue.increment(plan.revealsGranted);
      } else if (wasCompleted && targetRevealId && wasUnlinked) {
        updates.revealsAllowed = Math.max(0, Number(freshUser.revealsAllowed ?? 0) - plan.revealsGranted);
      }
    } else {
      nextPurchases.push({
        purchaseId: randomUUID(),
        plan: planId,
        purchasedAt: admin.firestore.Timestamp.now(),
        amountPaid,
        currency,
        stripeSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        status: "completed",
        revealsGranted: plan.revealsGranted,
        revealEnquiryId: targetRevealId,
      });

      if (!targetRevealId) {
        updates.revealsAllowed = admin.firestore.FieldValue.increment(plan.revealsGranted);
      }
    }

    const freshRevealSnap = revealRef ? await tx.get(revealRef) : null;

    tx.update(userRef, updates);

    if (revealRef && freshRevealSnap) {
      if (!freshRevealSnap.exists) throw new Error(`Reveal ${targetRevealId} does not exist.`);
      const revealData = freshRevealSnap.data() ?? {};
      const stages = revealData.stages && typeof revealData.stages === "object" ? revealData.stages : {};
      tx.update(revealRef, {
        plan: revealData.plan ?? planId,
        paymentStatus: "completed",
        stripeSessionId: revealData.stripeSessionId ?? session.id,
        stripePaymentIntentId: revealData.stripePaymentIntentId ?? paymentIntentId,
        amountTotal: revealData.amountTotal ?? amountPaid,
        stages: {
          ...stages,
          paymentReceived: stages.paymentReceived ?? serverTimestamp,
        },
        updatedAt: serverTimestamp,
      });
    }
  });

  console.log("Firebase payment reconciliation applied successfully.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
