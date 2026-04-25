export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader } from "@/lib/authServer";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { deleteEnquiryPhotosAdmin } from "@/lib/storageServiceAdmin";
import { buildShadowRecord, writeShadowRecord } from "@/lib/deletedUsers";
import type { FirestoreUser } from "@/lib/userService";

// ─── POST /api/delete-account ───────────────────────────────

/**
 * Hard-delete the authenticated user's account and all their data.
 *
 * Cleanup order:
 *   1. Read user doc + count enquiries (needed for shadow record)
 *   2. Write shadow record to deleted_users (30-day retention, then auto-purged)
 *   3. For each enquiry: delete Storage photos + secure-genders doc + enquiry doc
 *   4. Delete user doc
 *   5. Delete Firebase Auth user (so they can't log in again with this account)
 *
 * Storage deletion failures are logged but do NOT stop the overall delete —
 * orphaned photos can be cleaned up later by a cron job. The priority is
 * removing the user's ability to access the account and their personal Firestore data.
 *
 * The shadow record write is best-effort — if it fails, we still proceed with
 * the delete. Better to delete the user with no shadow than to refuse to delete
 * them at all and leave the account active.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuthHeader(req.headers.get("Authorization"));
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in and try again." },
        { status: 401 }
      );
    }

    const uid = session.uid;
    const db = getAdminDb();
    const adminAuth = getAdminAuth();

    // Track everything for the response + server logs
    const cleanup = {
      enquiriesDeleted: 0,
      secureGendersDeleted: 0,
      photosDeleted: 0,
      photosFailed: 0,
      storageErrors: [] as string[],
      shadowRecordWritten: false,
    };

    // 1. Read user doc + enquiries up front (needed for shadow record)
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.exists ? (userSnap.data() as FirestoreUser) : null;

    const enquiriesSnap = await db
      .collection("enquiries")
      .where("userId", "==", uid)
      .get();

    // 2. Write shadow record BEFORE deletions
    //    Best-effort: log failure but don't stop the delete.
    if (userData) {
      try {
        const shadow = buildShadowRecord({
          user: userData,
          enquiryCount: enquiriesSnap.size,
          deletedBy: "user",
        });
        await writeShadowRecord(shadow);
        cleanup.shadowRecordWritten = true;
      } catch (shadowErr) {
        console.error(
          `[delete-account] Failed to write shadow record for ${uid}:`,
          shadowErr
        );
        // Continue — better to delete the user than to leave them stuck
      }
    } else {
      // No user doc — nothing to shadow. Probably an Auth-only orphan.
      console.warn(
        `[delete-account] No user doc found for uid=${uid}; skipping shadow record.`
      );
    }

    // 3. For each enquiry, delete photos + secure-genders doc + enquiry doc
    for (const enquiryDoc of enquiriesSnap.docs) {
      const enquiryId = enquiryDoc.id;

      // Delete Storage photos (non-fatal — log failures)
      const photoResult = await deleteEnquiryPhotosAdmin(enquiryId);
      cleanup.photosDeleted += photoResult.deleted;
      cleanup.photosFailed += photoResult.failed;
      if (photoResult.errors.length > 0) {
        cleanup.storageErrors.push(...photoResult.errors);
        console.error(
          `[delete-account] Photo deletion partial failure for enquiry ${enquiryId}:`,
          photoResult.errors
        );
      }

      // Delete secure-genders doc (1:1 with enquiry)
      try {
        await db.collection("secure-genders").doc(enquiryId).delete();
        cleanup.secureGendersDeleted++;
      } catch (err) {
        console.error(
          `[delete-account] Failed to delete secure-genders/${enquiryId}:`,
          err
        );
      }

      // Delete enquiry doc
      try {
        await enquiryDoc.ref.delete();
        cleanup.enquiriesDeleted++;
      } catch (err) {
        console.error(
          `[delete-account] Failed to delete enquiry ${enquiryId}:`,
          err
        );
      }
    }

    // 4. Delete user doc
    try {
      await db.collection("users").doc(uid).delete();
    } catch (err) {
      console.error(`[delete-account] Failed to delete users/${uid}:`, err);
      // Not fatal — we still delete the Auth user below
    }

    // 5. Delete Firebase Auth user
    //    This is the most important step — once this succeeds, the user
    //    can no longer log in with this account.
    try {
      await adminAuth.deleteUser(uid);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== "auth/user-not-found") {
        console.error(`[delete-account] Failed to delete Auth user ${uid}:`, err);
        return NextResponse.json(
          { error: "Failed to delete account. Please try again or contact support." },
          { status: 500 }
        );
      }
      // user-not-found means they were already deleted from Auth — treat as success
    }

    // Log final summary server-side (helpful for manual cleanup)
    if (cleanup.photosFailed > 0 || cleanup.storageErrors.length > 0) {
      console.warn(
        `[delete-account] Completed with storage issues for uid=${uid}:`,
        cleanup
      );
    } else {
      console.log(`[delete-account] Clean delete for uid=${uid}:`, cleanup);
    }

    return NextResponse.json({
      success: true,
      cleanup,
    });
  } catch (err) {
    console.error("[delete-account] Unexpected error:", err);
    const msg = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
