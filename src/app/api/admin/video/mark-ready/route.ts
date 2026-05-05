export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { verifyAuthHeader } from "@/lib/authServer";
import { getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const session = await verifyAuthHeader(req.headers.get("Authorization"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userSnap = await getAdminDb().collection("users").doc(session.uid).get();
  const role = (userSnap.data()?.role as string | undefined)?.toLowerCase();
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { enquiryId?: string; streamUid?: string };
  const enquiryId = body.enquiryId?.trim();
  const streamUid = body.streamUid?.trim();
  if (!enquiryId || !streamUid) return NextResponse.json({ error: "enquiryId and streamUid are required." }, { status: 400 });

  const customerSubdomain = process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim();
  const videoUrl = customerSubdomain
    ? `https://${customerSubdomain}/${streamUid}/watch`
    : `https://iframe.videodelivery.net/${streamUid}`;

  await getAdminDb().collection("enquiries").doc(enquiryId).update({
    videoUrl,
    streamUid,
    status: "video_ready",
    "stages.videoGenerated": Timestamp.now(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true, videoUrl });
}

