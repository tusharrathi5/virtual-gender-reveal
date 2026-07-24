export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader } from "@/lib/authServer";
import { getAdminDb } from "@/lib/firebase-admin";
import { isStreamReady } from "@/lib/cloudflareStream";
import { finalizeUploadedVideo } from "@/lib/videoReady";

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

  const body = (await req.json().catch(() => ({}))) as { enquiryId?: string; streamUid?: string };
  const enquiryId = body.enquiryId?.trim();
  const streamUid = body.streamUid?.trim();
  if (!enquiryId || !streamUid) {
    return NextResponse.json({ error: "enquiryId and streamUid are required." }, { status: 400 });
  }

  const db = getAdminDb();
  const enquiryRef = db.collection("enquiries").doc(enquiryId);
  const enquirySnap = await enquiryRef.get();
  if (!enquirySnap.exists) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });

  const enquiry = enquirySnap.data() as {
    videoUrl?: string | null;
    streamUid?: string | null;
    pendingStreamUid?: string | null;
  };
  if (typeof enquiry.videoUrl === "string" && enquiry.videoUrl.trim() && enquiry.streamUid !== streamUid) {
    return NextResponse.json(
      { error: "A video is already uploaded. Delete it before uploading a replacement." },
      { status: 409 }
    );
  }

  if (!(await isStreamReady(streamUid))) {
    return NextResponse.json({
      success: true,
      processing: true,
      message: "Video uploaded and is still processing.",
    });
  }

  const ready = await finalizeUploadedVideo({ enquiryId, streamUid });
  return NextResponse.json({ success: true, ...ready });
}
