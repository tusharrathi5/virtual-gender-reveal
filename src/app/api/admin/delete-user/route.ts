export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { deleteEnquiryPhotosAdmin } from "@/lib/storageServiceAdmin";
import { buildShadowRecord, writeShadowRecord } from "@/lib/deletedUsers";
import type { FirestoreUser } from "@/lib/userService";

// ─── Admin Verification ─────────────────────────────────────

async function verifyAdmin(request: NextRequest): Promise<{ uid: string } | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);

    // Check admin role in Firestore
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

// ─── POST /api/admin/delete-user ────────────────────────────

/**
 * Body: { uid: string, hardDelete: boolean }
 *
 * HARD DELETE flow (matches /api/delete-account exactly, but admin-triggered):
 *   1. Read user doc + count enquiries
 *   2. Write shadow record (deletedBy: "admin")
 *   3. For each enquiry: delete photos + secure-genders + enquiry doc
 *   4. Delete user doc
 *   5. Delete Auth user
 *
 * SOFT DELETE flow:
 *   - Disable user in Firebase Auth
 *   - Mark isDeleted: true on user doc
 *   - Write shadow record (deletedBy: "admin", but this is reversible — see below)
 *
 * Note on soft-delete shadow records: we DO write a shadow record on soft-delete
 * because admin support may need to see the user's history while they're disabled.
 * If the admin re-enables the user (PUT with action: "enable"), we delete the
 * shadow record to keep things consistent.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const { uid, hardDelete = false } = await request.json();

    if (!uid || typeof uid !== "string") {
      return NextResponse.json(
        { error: "User ID is required." },
        { status: 400 }
      );
    }

    // Prevent admin from deleting themselves
    if (uid === admin.uid) {
      return NextResponse.json(
        { error: "You cannot delete your own account from admin panel." },
        { status: 400 }
      );
    }

    const adminAuth = getAdminAuth();
    const db = getAdminDb();

    // Read user doc + enquiries up front (needed for shadow record)
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }
    const userData = userSnap.data() as FirestoreUser;

    const enquiriesSnap = await db
      .collection("enquiries")
      .where("userId", "==", uid)
      .get();

    // Write shadow record (best-effort, applies to both hard and soft deletes)
    let shadowRecordWritten = false;
    try {
      const shadow = buildShadowRecord({
        user: userData,
        enquiryCount: enquiriesSnap.size,
        deletedBy: "admin",
      });
      await writeShadowRecord(shadow);
      shadowRecordWritten = true;
    } catch (shadowErr) {
      console.error(
        `[admin/delete-user] Failed to write shadow record for ${uid}:`,
        shadowErr
      );
      // Continue — don't block the delete on shadow write failure
    }

    if (hardDelete) {
      // ─── HARD DELETE ─────────────────────────────────────
      const cleanup = {
        enquiriesDeleted: 0,
        secureGendersDeleted: 0,
        photosDeleted: 0,
        photosFailed: 0,
        storageErrors: [] as string[],
        shadowRecordWritten,
      };

      // For each enquiry: photos → secure-genders → enquiry doc
      for (const enquiryDoc of enquiriesSnap.docs) {
        const enquiryId = enquiryDoc.id;

        const photoResult = await deleteEnquiryPhotosAdmin(enquiryId);
        cleanup.photosDeleted += photoResult.deleted;
        cleanup.photosFailed += photoResult.failed;
        if (photoResult.errors.length > 0) {
          cleanup.storageErrors.push(...photoResult.errors);
          console.error(
            `[admin/delete-user] Photo deletion partial failure for enquiry ${enquiryId}:`,
            photoResult.errors
          );
        }

        try {
          await db.collection("secure-genders").doc(enquiryId).delete();
          cleanup.secureGendersDeleted++;
        } catch (err) {
          console.error(
            `[admin/delete-user] Failed to delete secure-genders/${enquiryId}:`,
            err
          );
        }

        try {
          await enquiryDoc.ref.delete();
          cleanup.enquiriesDeleted++;
        } catch (err) {
          console.error(
            `[admin/delete-user] Failed to delete enquiry ${enquiryId}:`,
            err
          );
        }
      }

      // Delete user doc
      try {
        await db.collection("users").doc(uid).delete();
      } catch (err) {
        console.error(`[admin/delete-user] Failed to delete users/${uid}:`, err);
      }

      // Delete Auth user
      try {
        await adminAuth.deleteUser(uid);
      } catch (authErr: unknown) {
        const code = (authErr as { code?: string })?.code;
        if (code !== "auth/user-not-found") {
          console.error(
            `[admin/delete-user] Failed to delete Auth user ${uid}:`,
            authErr
          );
          // The user doc + enquiries are gone but Auth user remains.
          // This is a problem — surface it.
          return NextResponse.json(
            {
              error:
                "User data deleted but Auth user removal failed. Manual cleanup needed in Firebase Console.",
              cleanup,
            },
            { status: 500 }
          );
        }
      }

      console.log(`[admin/delete-user] HARD delete by ${admin.uid} of ${uid}:`, cleanup);

      return NextResponse.json({
        success: true,
        message: "User permanently deleted.",
        type: "hard",
        cleanup,
      });
    } else {
      // ─── SOFT DELETE ─────────────────────────────────────
      // Disable in Firebase Auth + mark user doc as deleted.
      // Enquiries/photos/secure-genders STAY — they can be restored via "enable".
      try {
        await adminAuth.updateUser(uid, { disabled: true });
      } catch (err) {
        console.error(`[admin/delete-user] Auth disable failed for ${uid}:`, err);
        return NextResponse.json(
          { error: "Failed to disable user in Auth." },
          { status: 500 }
        );
      }

      await db.collection("users").doc(uid).update({
        isDeleted: true,
        status: "disabled",
        updatedAt: new Date(),
      });

      console.log(`[admin/delete-user] SOFT delete by ${admin.uid} of ${uid}`);

      return NextResponse.json({
        success: true,
        message: "User disabled and soft-deleted.",
        type: "soft",
        shadowRecordWritten,
      });
    }
  } catch (err) {
    console.error("[admin/delete-user] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to delete user. Please try again." },
      { status: 500 }
    );
  }
}

// ─── PUT /api/admin/delete-user ─────────────────────────────

/**
 * Body: { uid: string, action: "disable" | "enable" | "update-role", role?: "user" | "admin" }
 *
 * On "enable" we also delete any existing shadow record for this user, since
 * they're being un-deleted and don't need to appear in the deleted_users list.
 */
export async function PUT(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    const { uid, action, role } = await request.json();
    if (!uid || !action) {
      return NextResponse.json(
        { error: "uid and action are required." },
        { status: 400 }
      );
    }

    // Prevent self-modification on critical actions
    if (uid === admin.uid && (action === "disable" || action === "update-role")) {
      return NextResponse.json(
        { error: "You cannot disable or change the role of your own admin account." },
        { status: 400 }
      );
    }

    const adminAuth = getAdminAuth();
    const db = getAdminDb();

    if (action === "disable") {
      await adminAuth.updateUser(uid, { disabled: true });
      await db.collection("users").doc(uid).update({
        status: "disabled",
        updatedAt: new Date(),
      });
      return NextResponse.json({ success: true, message: "User disabled." });
    }

    if (action === "enable") {
      await adminAuth.updateUser(uid, { disabled: false });
      await db.collection("users").doc(uid).update({
        status: "active",
        isDeleted: false,
        updatedAt: new Date(),
      });

      // Remove shadow record if one exists — the user is no longer "deleted"
      try {
        await db.collection("deleted_users").doc(uid).delete();
      } catch (err) {
        // Doc not existing is fine; log other errors but don't fail the request
        console.warn(
          `[admin/delete-user] Could not delete shadow record for ${uid} on enable:`,
          err
        );
      }

      return NextResponse.json({ success: true, message: "User enabled." });
    }

    if (action === "update-role") {
      if (!["user", "admin"].includes(role)) {
        return NextResponse.json({ error: "Invalid role." }, { status: 400 });
      }
      await db.collection("users").doc(uid).update({
        role,
        updatedAt: new Date(),
      });
      return NextResponse.json({
        success: true,
        message: `Role updated to ${role}.`,
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("[admin/delete-user] PUT error:", err);
    return NextResponse.json(
      { error: "Failed to update user." },
      { status: 500 }
    );
  }
}
