export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import CryptoJS from "crypto-js";
import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader } from "@/lib/authServer";
import { getAdminDb } from "@/lib/firebase-admin";
import { generateGuestToken } from "@/lib/guestToken";
import { sendGuestInviteEmail } from "@/lib/resendEmail";

export async function POST(req: NextRequest) {
  const session = await verifyAuthHeader(req.headers.get("Authorization"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { action?: "resend" | "revoke"; guestId?: string } | null;
  const action = body?.action;
  const guestId = body?.guestId?.trim();
  if (!action || !guestId) return NextResponse.json({ error: "action and guestId are required." }, { status: 400 });

  const guestRef = getAdminDb().collection("guest_invites").doc(guestId);
  const guestSnap = await guestRef.get();
  if (!guestSnap.exists) return NextResponse.json({ error: "Guest not found." }, { status: 404 });
  const guest = guestSnap.data() as { enquiryId: string; name: string; email: string };

  const enquiryRef = getAdminDb().collection("enquiries").doc(guest.enquiryId);
  const enquirySnap = await enquiryRef.get();
  if (!enquirySnap.exists) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  const enquiry = enquirySnap.data() as { userId: string; parentName?: string; revealAt?: { toDate: () => Date } };
  if (enquiry.userId !== session.uid) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  if (action === "revoke") {
    await guestRef.update({ inviteStatus: "revoked", tokenHash: null, updatedAt: new Date() });
    return NextResponse.json({ success: true });
  }

  const token = generateGuestToken(guest.enquiryId, guestId);
  const tokenHash = CryptoJS.SHA256(token).toString();
  await guestRef.update({ tokenHash, inviteStatus: "resent", updatedAt: new Date() });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "";
  if (!appUrl) return NextResponse.json({ error: "Missing app URL." }, { status: 500 });
  const inviteUrl = `${appUrl.replace(/\/$/, "")}/guest/${encodeURIComponent(token)}`;
  await sendGuestInviteEmail({
    to: guest.email,
    guestName: guest.name,
    parentName: enquiry.parentName || "the parents",
    revealAtIso: enquiry.revealAt?.toDate?.().toISOString?.() || new Date().toISOString(),
    inviteUrl,
  });
  return NextResponse.json({ success: true });
}

