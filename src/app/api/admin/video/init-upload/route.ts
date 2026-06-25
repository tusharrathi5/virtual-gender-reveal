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

  const enquiry = enquirySnap.data() as {
    videoUrl?: string | null;
    videoUploadStatus?: string | null;
  };
  if (typeof enquiry.videoUrl === "string" && enquiry.videoUrl.trim()) {
    return NextResponse.json(
      { error: "A video is already uploaded. Delete it before uploading a replacement." },
      { status: 409 }
    );
  }
  if (enquiry.videoUploadStatus === "uploading") {
    return NextResponse.json(
      { error: "A video upload is already in progress for this reveal." },
      { status: 409 }
    );
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_STREAM_TOKEN?.trim();
  if (!accountId || !apiToken) return NextResponse.json({ error: "Cloudflare env vars missing." }, { status: 500 });

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      maxDurationSeconds: 3600,
      meta: { enquiryId: id },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success || !data.result?.uploadURL || !data.result?.uid) {
    return NextResponse.json({ error: "Failed to initialize upload.", details: data }, { status: 502 });
  }

  await enquiryRef.update({
    pendingStreamUid: data.result.uid,
    videoUploadStatus: "uploading",
    status: "video_in_progress",
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({
    success: true,
    uploadURL: data.result.uploadURL,
    uid: data.result.uid,
  });
}
