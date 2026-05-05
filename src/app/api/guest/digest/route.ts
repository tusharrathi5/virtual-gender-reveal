export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { verifyAuthHeader } from "@/lib/authServer";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendGuestDigestEmail } from "@/lib/resendEmail";

export async function POST(req: NextRequest) {
  const session = await verifyAuthHeader(req.headers.get("Authorization"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { enquiryId?: string } | null;
  const enquiryId = body?.enquiryId?.trim();
  if (!enquiryId) return NextResponse.json({ error: "enquiryId is required." }, { status: 400 });

  const enquiryRef = getAdminDb().collection("enquiries").doc(enquiryId);
  const enquirySnap = await enquiryRef.get();
  if (!enquirySnap.exists) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  const enquiry = enquirySnap.data() as { userId: string; parentName?: string; revealAt?: Timestamp; stages?: { parentDigestSent?: unknown } };
  if (enquiry.userId !== session.uid) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (enquiry.stages?.parentDigestSent) return NextResponse.json({ error: "Digest already sent." }, { status: 409 });

  const revealAt = enquiry.revealAt?.toDate?.() ?? null;
  if (!revealAt || Date.now() < revealAt.getTime()) {
    return NextResponse.json({ error: "Digest can be sent only on/after reveal date." }, { status: 400 });
  }

  const userSnap = await getAdminDb().collection("users").doc(session.uid).get();
  const userEmail = (userSnap.data()?.email as string | undefined) || session.email;
  if (!userEmail) return NextResponse.json({ error: "No parent email found." }, { status: 400 });

  const guestSnap = await getAdminDb().collection("guest_invites").where("enquiryId", "==", enquiryId).get();
  const responses = guestSnap.docs
    .map((d) => d.data() as { name?: string; prediction?: string; message?: string | null })
    .filter((g) => g.prediction)
    .map((g) => ({ name: g.name || "Guest", prediction: g.prediction || "—", message: g.message || null }));

  await sendGuestDigestEmail({
    to: userEmail,
    parentName: enquiry.parentName || "there",
    revealDateLabel: revealAt.toLocaleString("en-US"),
    responses,
  });

  await enquiryRef.update({ "stages.parentDigestSent": Timestamp.now(), updatedAt: FieldValue.serverTimestamp() });
  return NextResponse.json({ success: true, sent: responses.length });
}

