export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { verifyAuthHeader } from "@/lib/authServer";
import { getAdminDb } from "@/lib/firebase-admin";
import { generateGuestToken } from "@/lib/guestToken";
import { sendGuestInviteEmail } from "@/lib/resendEmail";

interface GuestInput { name: string; email: string }

export async function POST(req: NextRequest) {
  const session = await verifyAuthHeader(req.headers.get("Authorization"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { enquiryId?: string; guests?: GuestInput[] } | null;
  const enquiryId = body?.enquiryId?.trim();
  const guests = body?.guests ?? [];
  if (!enquiryId || !Array.isArray(guests) || guests.length === 0) {
    return NextResponse.json({ error: "enquiryId and guests are required." }, { status: 400 });
  }

  const enquiryRef = getAdminDb().collection("enquiries").doc(enquiryId);
  const enquirySnap = await enquiryRef.get();
  if (!enquirySnap.exists) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  const enquiry = enquirySnap.data() as { userId: string; parentName?: string; revealAt?: Timestamp };
  if (enquiry.userId !== session.uid) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "";
  if (!appUrl) return NextResponse.json({ error: "Missing app URL." }, { status: 500 });

  let sent = 0;
  for (const g of guests) {
    if (!g?.email || !g?.name) continue;
    const guestRef = getAdminDb().collection("guest_invites").doc();
    const token = generateGuestToken(enquiryId, guestRef.id);
    const tokenHash = require("crypto-js").SHA256(token).toString();

    await guestRef.set({
      guestId: guestRef.id,
      enquiryId,
      name: g.name.trim(),
      email: g.email.trim().toLowerCase(),
      tokenHash,
      inviteStatus: "sent",
      prediction: null,
      message: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const inviteUrl = `${appUrl.replace(/\/$/, "")}/guest/${encodeURIComponent(token)}`;
    await sendGuestInviteEmail({
      to: g.email.trim().toLowerCase(),
      guestName: g.name.trim(),
      parentName: enquiry.parentName || "the parents",
      revealAtIso: enquiry.revealAt?.toDate?.().toISOString?.() || new Date().toISOString(),
      inviteUrl,
    });
    sent += 1;
  }

  await enquiryRef.update({
    guestCount: FieldValue.increment(sent),
    "stages.guestInvitesSent": Timestamp.now(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true, sent });
}
