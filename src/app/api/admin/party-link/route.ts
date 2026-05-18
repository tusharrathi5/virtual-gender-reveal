export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import CryptoJS from "crypto-js";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader } from "@/lib/authServer";
import { getAdminDb } from "@/lib/firebase-admin";
import { generateGuestToken } from "@/lib/guestToken";

type AdminSession = {
  uid: string;
  email: string | undefined;
};

type EnquiryRecord = {
  userId?: string;
  parentName?: string;
};

function getAppUrl(req: NextRequest) {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (configured) return configured.replace(/\/$/, "");

  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return "";
  const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`.replace(/\/$/, "");
}

async function verifyAdmin(req: NextRequest): Promise<AdminSession | null> {
  const session = await verifyAuthHeader(req.headers.get("Authorization"));
  if (!session) return null;

  const userSnap = await getAdminDb().collection("users").doc(session.uid).get();
  const role = userSnap.data()?.role;
  if (role !== "admin") return null;

  return { uid: session.uid, email: session.email };
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { enquiryId?: string } | null;
  const enquiryId = body?.enquiryId?.trim();
  if (!enquiryId) return NextResponse.json({ error: "enquiryId is required." }, { status: 400 });

  const db = getAdminDb();
  const enquirySnap = await db.collection("enquiries").doc(enquiryId).get();
  if (!enquirySnap.exists) return NextResponse.json({ error: "Reveal not found." }, { status: 404 });

  const enquiry = enquirySnap.data() as EnquiryRecord;
  const adminGuestId = `admin-party-${enquiryId}`;
  const token = generateGuestToken(enquiryId, adminGuestId);
  const tokenHash = CryptoJS.SHA256(token).toString();
  const adminInviteRef = db.collection("guest_invites").doc(adminGuestId);
  const adminInviteSnap = await adminInviteRef.get();

  const invitePayload: Record<string, unknown> = {
    guestId: adminGuestId,
    enquiryId,
    name: "Admin Preview",
    phone: "",
    email: admin.email || "",
    isHost: false,
    isAdminPartyLink: true,
    tokenHash,
    inviteStatus: "admin_link_ready",
    prediction: null,
    message: null,
    updatedAt: FieldValue.serverTimestamp(),
    createdByAdminUid: admin.uid,
    ownerUserId: enquiry.userId || "",
    parentName: enquiry.parentName || "",
  };

  if (!adminInviteSnap.exists) {
    invitePayload.createdAt = FieldValue.serverTimestamp();
  }

  await adminInviteRef.set(invitePayload, { merge: true });

  const appUrl = getAppUrl(req);
  if (!appUrl) return NextResponse.json({ error: "Missing app URL." }, { status: 500 });

  return NextResponse.json({
    success: true,
    partyUrl: `${appUrl}/guest/${encodeURIComponent(token)}`,
  });
}
