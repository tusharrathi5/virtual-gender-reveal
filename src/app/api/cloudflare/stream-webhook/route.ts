export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

type CloudflareWebhookBody = {
  uid?: string;
  readyToStream?: boolean;
  status?: {
    state?: string;
  };
  meta?: {
    enquiryId?: string;
  };
};

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

function parseWebhookSignature(header: string | null) {
  if (!header) return null;

  const values = new Map<string, string>();
  for (const part of header.split(",")) {
    const [key, ...rest] = part.split("=");
    if (!key || rest.length === 0) continue;
    values.set(key.trim(), rest.join("=").trim());
  }

  const time = Number(values.get("time"));
  const sig1 = values.get("sig1");
  if (!Number.isFinite(time) || !sig1) return null;

  return { time, sig1 };
}

function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | null, secret: string) {
  const parsed = parseWebhookSignature(signatureHeader);
  if (!parsed || !/^[a-f0-9]+$/i.test(parsed.sig1)) return false;

  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parsed.time) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const signedPayload = Buffer.concat([
    Buffer.from(`${parsed.time}.`, "utf8"),
    rawBody,
  ]);
  const expectedSignature = createHmac("sha256", secret).update(signedPayload).digest();
  const providedSignature = Buffer.from(parsed.sig1, "hex");

  return (
    providedSignature.length === expectedSignature.length &&
    timingSafeEqual(providedSignature, expectedSignature)
  );
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLOUDFLARE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error("[cloudflare-webhook] CLOUDFLARE_WEBHOOK_SECRET is not configured.");
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 });
  }

  const rawBody = Buffer.from(await req.arrayBuffer());
  if (!verifyWebhookSignature(rawBody, req.headers.get("Webhook-Signature"), webhookSecret)) {
    return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
  }

  let body: CloudflareWebhookBody | null = null;
  try {
    body = JSON.parse(rawBody.toString("utf8")) as CloudflareWebhookBody;
  } catch {
    body = null;
  }

  if (!body?.uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  const enquiryId = body.meta?.enquiryId?.trim();
  const ready = body.readyToStream || body.status?.state === "ready";
  if (!enquiryId || !ready) return NextResponse.json({ success: true, ignored: true });

  const customerSubdomain = process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim();
  const videoUrl = customerSubdomain
    ? `https://${customerSubdomain}/${body.uid}/watch`
    : `https://iframe.videodelivery.net/${body.uid}`;

  await getAdminDb().collection("enquiries").doc(enquiryId).update({
    streamUid: body.uid,
    videoUrl,
    status: "video_ready",
    "stages.videoGenerated": Timestamp.now(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true });
}
