export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { decryptGender } from "@/lib/doctorToken";
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
 * Returns the decrypted gender value for an enquiry. The codebase has two
 * separate gender storage systems and we need to handle both:
 *
 *   1. New system (announcement mode + new reveal flows):
 *      - Stored in `secure-genders/{enquiryId}` document
 *      - Encrypted via secureGenderService (AES-GCM with iv/authTag/keyVersion)
 *      - Read via getDecryptedGender(enquiryId) which handles the schema
 *
 *   2. Legacy system (older reveal flows via /api/doctor/[token]):
 *      - Stored as `genderEncrypted` field directly on the enquiry doc
 *      - Encrypted via doctorToken.encryptGender (single string blob)
 *      - Read via decryptGender(blob)
 *
 * We try the new system first, fall back to legacy, and return the decrypted
 * value if either succeeds.
 *
 * NOTE: In Next.js 15+, `params` is a Promise that must be awaited.
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

  // ── 1. Try new system (secure-genders collection) ──
  try {
    const gender = await getDecryptedGender(enquiryId);
    if (gender) {
      console.log(
        `[admin/gender] Admin ${admin.uid} decrypted gender for ${enquiryId} (source: secureGenderService)`
      );
      return NextResponse.json({ gender, source: "secureGenderService" });
    }
  } catch (err) {
    console.error(
      `[admin/gender] secureGenderService failed for ${enquiryId}:`,
      err
    );
    // fall through to legacy lookup
  }

  // ── 2. Try legacy system (genderEncrypted on enquiry doc) ──
  try {
    const db = getAdminDb();
    const snap = await db.collection("enquiries").doc(enquiryId).get();

    if (!snap.exists) {
      return NextResponse.json({
        gender: null,
        reason: "enquiry_not_found",
      });
    }

    const data = snap.data() ?? {};
    const encrypted = data.genderEncrypted;

    if (typeof encrypted === "string" && encrypted.length > 0) {
      try {
        const gender = decryptGender(encrypted);
        console.log(
          `[admin/gender] Admin ${admin.uid} decrypted gender for ${enquiryId} (source: legacy doctorToken)`
        );
        return NextResponse.json({ gender, source: "doctorToken" });
      } catch (decryptErr) {
        console.error(
          `[admin/gender] Legacy decryptGender failed for ${enquiryId}:`,
          decryptErr
        );
      }
    }

    // ── 3. Nothing found anywhere ──
    return NextResponse.json({
      gender: null,
      reason: "not_submitted",
    });
  } catch (err) {
    console.error(
      `[admin/gender] Failed to look up gender for enquiry ${enquiryId}:`,
      err
    );
    const msg =
      err instanceof Error ? err.message : "Failed to fetch gender.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
