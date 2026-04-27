export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { decryptGender } from "@/lib/doctorToken";

// ─── Admin verification ──────────────────────────────────────────────────────

async function verifyAdmin(request: NextRequest): Promise<{ uid: string } | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);

    const db = getAdminDb();
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;
    const userData = userDoc.data();
    if (userData?.role !== "admin") return null;

    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

// ─── GET /api/admin/gender/[enquiryId] ───────────────────────────────────────

/**
 * Returns the decrypted gender value for an enquiry.
 *
 * Reads `genderEncrypted` directly from the enquiry doc (the format the
 * /api/doctor/[token] route currently writes). Decrypts using decryptGender
 * from @/lib/doctorToken.
 *
 * NOTE: In Next.js 15+, the `params` object is a Promise that must be awaited.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enquiryId: string }> }
) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorized. Admin access required." },
      { status: 403 }
    );
  }

  const { enquiryId } = await params;
  if (!enquiryId || typeof enquiryId !== "string") {
    return NextResponse.json(
      { error: "Missing enquiryId." },
      { status: 400 }
    );
  }

  try {
    const db = getAdminDb();
    const snap = await db.collection("enquiries").doc(enquiryId).get();

    if (!snap.exists) {
      return NextResponse.json({
        gender: null,
        reason: "enquiry_not_found",
      });
    }

    const data = snap.data();
    const encrypted = data?.genderEncrypted;

    if (!encrypted || typeof encrypted !== "string") {
      return NextResponse.json({
        gender: null,
        reason: "not_submitted",
      });
    }

    const gender = decryptGender(encrypted);

    console.log(
      `[admin/gender] Admin ${admin.uid} decrypted gender for enquiry ${enquiryId}`
    );

    return NextResponse.json({ gender });
  } catch (err) {
    console.error(
      `[admin/gender] Failed to decrypt gender for enquiry ${enquiryId}:`,
      err
    );
    const msg =
      err instanceof Error ? err.message : "Failed to decrypt gender.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
