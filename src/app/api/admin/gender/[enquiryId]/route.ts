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
 * Looks in multiple possible storage locations to be tolerant of older and
 * newer enquiry shapes (announcement mode vs reveal mode, doctor route vs
 * direct submission, old encryption helper vs secureGenderService):
 *
 *   1. `enquiry.genderEncrypted` — doctor route format (from /api/doctor/[token])
 *   2. `enquiry.gender` — plaintext (announcement mode may store it directly)
 *   3. `enquiry.genderPlaintext` / `enquiry.genderValue` — defensive aliases
 *   4. `secure-genders/{enquiryId}` doc — new secureGenderService format
 *
 * Whichever exists wins. Debug info on the response shows which path was used.
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

    // 1) Doctor-route format: encrypted blob on enquiry
    if (typeof data.genderEncrypted === "string" && data.genderEncrypted.length > 0) {
      try {
        const gender = decryptGender(data.genderEncrypted);
        console.log(
          `[admin/gender] Admin ${admin.uid} decrypted gender for ${enquiryId} (source: enquiry.genderEncrypted)`
        );
        return NextResponse.json({ gender, source: "genderEncrypted" });
      } catch (decryptErr) {
        console.error(
          `[admin/gender] decryptGender failed for ${enquiryId}:`,
          decryptErr
        );
        // fall through and try other sources
      }
    }

    // 2) Plaintext aliases — used by some create-reveal flows for announcement mode
    const plain =
      (typeof data.gender === "string" && data.gender) ||
      (typeof data.genderPlaintext === "string" && data.genderPlaintext) ||
      (typeof data.genderValue === "string" && data.genderValue) ||
      null;
    if (plain && (plain === "boy" || plain === "girl")) {
      console.log(
        `[admin/gender] Admin ${admin.uid} read plaintext gender for ${enquiryId}`
      );
      return NextResponse.json({ gender: plain, source: "plaintext" });
    }

    // 3) secureGenderService location
    const sgSnap = await db.collection("secure-genders").doc(enquiryId).get();
    if (sgSnap.exists) {
      const sg = sgSnap.data() ?? {};
      // Could be encrypted with doctorToken's encryptGender (a single string)
      if (typeof sg.genderEncrypted === "string" && sg.genderEncrypted.length > 0) {
        try {
          const gender = decryptGender(sg.genderEncrypted);
          console.log(
            `[admin/gender] Admin ${admin.uid} decrypted gender for ${enquiryId} (source: secure-genders.genderEncrypted)`
          );
          return NextResponse.json({ gender, source: "secure-genders" });
        } catch (decryptErr) {
          console.error(
            `[admin/gender] secure-genders decryptGender failed for ${enquiryId}:`,
            decryptErr
          );
        }
      }
      // Plaintext fallback inside secure-genders
      const sgPlain =
        (typeof sg.gender === "string" && sg.gender) ||
        (typeof sg.genderPlaintext === "string" && sg.genderPlaintext) ||
        null;
      if (sgPlain && (sgPlain === "boy" || sgPlain === "girl")) {
        return NextResponse.json({ gender: sgPlain, source: "secure-genders-plain" });
      }
    }

    // Nothing found — return debug info so you can see which fields the
    // enquiry actually has. Strip values, just send the keys for safety.
    const enquiryKeys = Object.keys(data);
    console.log(
      `[admin/gender] No gender found for ${enquiryId}. Enquiry keys: ${enquiryKeys.join(", ")}`
    );

    return NextResponse.json({
      gender: null,
      reason: "not_submitted",
      debug: {
        enquiryKeys,
        secureGendersDocExists: sgSnap.exists,
      },
    });
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
