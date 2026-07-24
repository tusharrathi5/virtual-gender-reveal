export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import CryptoJS from "crypto-js";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthHeader } from "@/lib/authServer";
import { getAdminDb } from "@/lib/firebase-admin";
import { generateGuestToken } from "@/lib/guestToken";
import {
  isBundleOfJoyAnnouncement,
  PARTY_UNAVAILABLE_MESSAGE,
} from "@/lib/revealAccess";

function getAppUrl(req: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  if (configured) return configured.replace(/\/$/, "");
  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  return "";
}

export async function POST(req: NextRequest) {
  const session = await verifyAuthHeader(req.headers.get("Authorization"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { enquiryId?: string } | null;
  const enquiryId = body?.enquiryId?.trim();
  if (!enquiryId) return NextResponse.json({ error: "enquiryId is required." }, { status: 400 });

  const db = getAdminDb();
  const enquiryRef = db.collection("enquiries").doc(enquiryId);
  const enquirySnap = await enquiryRef.get();
  if (!enquirySnap.exists) return NextResponse.json({ error: "Reveal not found." }, { status: 404 });
  const enquiry = enquirySnap.data() as {
    userId?: string;
    parentName?: string;
    mode?: string;
    plan?: string;
    partyEnabled?: boolean;
  };
  if (enquiry.userId !== session.uid) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (isBundleOfJoyAnnouncement(enquiry)) {
    return NextResponse.json(
      { error: PARTY_UNAVAILABLE_MESSAGE },
      { status: 409 }
    );
  }

  const hostGuestId = `host-party-${enquiryId}`;
  const token = generateGuestToken(enquiryId, hostGuestId);
  const tokenHash = CryptoJS.SHA256(token).toString();

  await db.collection("guest_invites").doc(hostGuestId).set({
    guestId: hostGuestId,
    enquiryId,
    name: "Host",
    phone: "",
    email: session.email || "",
    isHost: true,
    tokenHash,
    inviteStatus: "host_link_ready",
    prediction: null,
    message: null,
    parentName: enquiry.parentName || "",
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const appUrl = getAppUrl(req);
  if (!appUrl) return NextResponse.json({ error: "Missing app URL." }, { status: 500 });
  return NextResponse.json({ success: true, partyUrl: `${appUrl}/guest/${encodeURIComponent(token)}` });
}
