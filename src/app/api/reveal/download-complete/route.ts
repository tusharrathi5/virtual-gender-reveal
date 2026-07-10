export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyAuthHeader } from "@/lib/authServer";

export async function POST(req: NextRequest) {
  const session = await verifyAuthHeader(req.headers.get("Authorization"));
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { enquiryId } = (await req.json().catch(() => ({}))) as { enquiryId?: string };
  const id = enquiryId?.trim();
  if (!id) {
    return NextResponse.json({ error: "enquiryId is required." }, { status: 400 });
  }

  const db = getAdminDb();
  const enquiryRef = db.collection("enquiries").doc(id);
  const snap = await enquiryRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  }

  const data = snap.data() as { userId: string };
  if (data.userId !== session.uid) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  await enquiryRef.update({
    videoDownloaded: true,
    videoDownloadedAt: new Date(),
  });

  return NextResponse.json({ success: true });
}
