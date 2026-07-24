export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthHeader } from "@/lib/authServer";
import { getAdminDb } from "@/lib/firebase-admin";

async function requireAdmin(req: NextRequest) {
  const session = await verifyAuthHeader(req.headers.get("Authorization"));
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const userSnap = await getAdminDb().collection("users").doc(session.uid).get();
  const role = (userSnap.data()?.role as string | undefined)?.toLowerCase();
  if (role !== "admin") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  return { session };
}

async function deleteCloudflareVideo(streamUid: string): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_STREAM_TOKEN?.trim();
  if (!accountId || !apiToken) {
    throw new Error("Cloudflare env vars missing.");
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${streamUid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiToken}` },
  });

  if (response.status === 404) return;

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.errors?.[0]?.message || "Failed to delete video from Cloudflare.");
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin.error) return admin.error;

  const { enquiryId } = (await req.json().catch(() => ({}))) as { enquiryId?: string };
  const id = enquiryId?.trim();
  if (!id) return NextResponse.json({ error: "enquiryId is required." }, { status: 400 });

  const db = getAdminDb();
  const enquiryRef = db.collection("enquiries").doc(id);
  const enquirySnap = await enquiryRef.get();
  if (!enquirySnap.exists) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });

  const enquiry = enquirySnap.data() as { streamUid?: string | null; pendingStreamUid?: string | null; videoUrl?: string | null };
  const streamUid = typeof enquiry.streamUid === "string" && enquiry.streamUid.trim()
    ? enquiry.streamUid.trim()
    : null;

  if (streamUid) {
    await deleteCloudflareVideo(streamUid);
  }

  await enquiryRef.update({
    videoUrl: FieldValue.delete(),
    downloadUrl: FieldValue.delete(),
    streamUid: FieldValue.delete(),
    pendingStreamUid: FieldValue.delete(),
    videoUploadStatus: "idle",
    status: "video_in_progress",
    "stages.videoGenerated": null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true });
}
