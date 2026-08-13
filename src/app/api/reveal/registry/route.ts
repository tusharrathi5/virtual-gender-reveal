export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthHeader } from "@/lib/authServer";
import { getAdminDb } from "@/lib/firebase-admin";
import { isBundleOfJoyAnnouncement } from "@/lib/revealAccess";

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const session = await verifyAuthHeader(req.headers.get("Authorization"));
  if (!session) {
    return NextResponse.json({ error: "Unauthorized. Please sign in and try again." }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { enquiryId?: string; registryUrl?: string | null } | null;
  const enquiryId = body?.enquiryId?.trim();
  if (!enquiryId) {
    return NextResponse.json({ error: "Missing enquiryId." }, { status: 400 });
  }

  const rawUrl = body?.registryUrl;
  const trimmedUrl = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (trimmedUrl && !isValidHttpUrl(trimmedUrl)) {
    return NextResponse.json({ error: "Please provide a valid registry link (starting with http:// or https://)." }, { status: 400 });
  }

  const db = getAdminDb();
  const enquiryRef = db.collection("enquiries").doc(enquiryId);
  const enquirySnap = await enquiryRef.get();
  if (!enquirySnap.exists) return NextResponse.json({ error: "Reveal not found." }, { status: 404 });

  const enquiry = enquirySnap.data() as { userId?: string; plan?: string; mode?: string; partyEnabled?: boolean };
  if (enquiry.userId !== session.uid) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  if (enquiry.plan === "basic") {
    return NextResponse.json({ error: "Gift registry links are available on paid plans only." }, { status: 403 });
  }
  if (isBundleOfJoyAnnouncement(enquiry)) {
    return NextResponse.json({ error: "Gift registry links require a party page, which isn't available for Bundle of Joy announcements." }, { status: 409 });
  }

  await enquiryRef.update({
    registryUrl: trimmedUrl || null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true, registryUrl: trimmedUrl || null });
}
