export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

type CloudflareWebhookBody = {
  uid?: string;
  status?: {
    state?: string;
    readyToStream?: boolean;
  };
  meta?: {
    enquiryId?: string;
  };
};

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.CLOUDFLARE_WEBHOOK_SECRET?.trim();
  if (expectedSecret) {
    const provided = req.headers.get("x-webhook-secret")?.trim();
    if (!provided || provided !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
    }
  }

  const body = (await req.json().catch(() => null)) as CloudflareWebhookBody | null;
  if (!body?.uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  const enquiryId = body.meta?.enquiryId?.trim();
  const ready = body.status?.readyToStream || body.status?.state === "ready";
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

