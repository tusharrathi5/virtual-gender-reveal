export const dynamic = "force-dynamic";
export const runtime = "nodejs";
 
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
 
// Verify the requesting user is an admin
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
 
// POST /api/admin/delete-user
// Body: { uid: string, hardDelete: boolean }
export async function POST(request: NextRequest) {
  try {
    // Verify admin
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }
 
    const { uid, hardDelete = false } = await request.json();
 
    if (!uid) {
      return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    }
 
    // Prevent admin from deleting themselves
    if (uid === admin.uid) {
      return NextResponse.json({ error: "You cannot delete your own account from admin panel." }, { status: 400 });
    }
 
    const adminAuth = getAdminAuth();
    const db = getAdminDb();
 
    if (hardDelete) {
      // HARD DELETE: Remove from Firebase Auth + Firestore
      try {
        await adminAuth.deleteUser(uid);
      } catch (authErr: unknown) {
        const err = authErr as { code?: string };
        if (err?.code !== "auth/user-not-found") {
          throw authErr;
        }
        // User already deleted from Auth — continue to delete Firestore doc
      }
      await db.collection("users").doc(uid).delete();
      return NextResponse.json({ success: true, message: "User permanently deleted.", type: "hard" });
    } else {
      // SOFT DELETE: Mark as deleted + disable in Firebase Auth
      await adminAuth.updateUser(uid, { disabled: true });
      await db.collection("users").doc(uid).update({
        isDeleted: true,
        status: "disabled",
        updatedAt: new Date(),
      });
      return NextResponse.json({ success: true, message: "User disabled and soft-deleted.", type: "soft" });
    }
  } catch (err) {
    console.error("Admin delete user error:", err);
    return NextResponse.json(
      { error: "Failed to delete user. Please try again." },
      { status: 500 }
    );
  }
}
 
// POST /api/admin/disable-user
// (also handled here via body param)
 
// POST /api/admin/reset-password
export async function PUT(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }
 
    const { uid, action, role } = await request.json();
    if (!uid || !action) {
      return NextResponse.json({ error: "uid and action are required." }, { status: 400 });
    }
 
    const adminAuth = getAdminAuth();
    const db = getAdminDb();
 
    if (action === "disable") {
      await adminAuth.updateUser(uid, { disabled: true });
      await db.collection("users").doc(uid).update({ status: "disabled", updatedAt: new Date() });
      return NextResponse.json({ success: true, message: "User disabled." });
    }
 
    if (action === "enable") {
      await adminAuth.updateUser(uid, { disabled: false });
      await db.collection("users").doc(uid).update({ status: "active", isDeleted: false, updatedAt: new Date() });
      return NextResponse.json({ success: true, message: "User enabled." });
    }
 
    if (action === "update-role") {
      if (!["user", "admin"].includes(role)) {
        return NextResponse.json({ error: "Invalid role." }, { status: 400 });
      }
      await db.collection("users").doc(uid).update({ role, updatedAt: new Date() });
      return NextResponse.json({ success: true, message: `Role updated to ${role}.` });
    }
 
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("Admin update user error:", err);
    return NextResponse.json({ error: "Failed to update user." }, { status: 500 });
  }
}
