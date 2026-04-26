export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { getDecryptedGender } from "@/lib/secureGenderService";

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
 * Auth: requires Authorization: Bearer <firebase-id-token> from a user whose
 * Firestore user doc has role === "admin".
 *
 * Returns:
 *   200 { gender: "boy" | "girl" }                 — successfully decrypted
 *   200 { gender: null, reason: "not_submitted" }  — no secure-genders doc exists yet
 *   403 { error: "..." }                            — caller not an admin
 *   500 { error: "..." }                            — decryption error / server failure
 *
 * The decryption key (GENDER_ENCRYPTION_KEY_V1) lives only on the server.
 * This is the ONLY way to read a gender value once it has been encrypted.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { enquiryId: string } }
) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorized. Admin access required." },
      { status: 403 }
    );
  }

  const enquiryId = params.enquiryId;
  if (!enquiryId || typeof enquiryId !== "string") {
    return NextResponse.json(
      { error: "Missing enquiryId." },
      { status: 400 }
    );
  }

  try {
    const gender = await getDecryptedGender(enquiryId);

    if (gender === null) {
      return NextResponse.json({
        gender: null,
        reason: "not_submitted",
      });
    }

    // Audit log — admin decryption events should be traceable.
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
