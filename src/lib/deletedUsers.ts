import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type { FirestoreUser, Purchase } from "@/lib/userService";

// ─── Types ──────────────────────────────────────────────────

/**
 * Shadow record stored after a user is deleted.
 * Retained for 30 days for support / fraud lookup, then auto-purged by cron.
 *
 * Privacy note: this record is disclosed in the privacy policy. Users consent
 * to retention at signup. After 30 days the record is permanently destroyed.
 */
export interface DeletedUserRecord {
  originalUid: string;
  parentName: string | null;       // displayName from user doc
  email: string | null;            // for admin support / fraud lookup
  phoneNumber: string | null;      // for admin support
  activePlan: string | null;       // "free" / "premium" / "custom" / null
  totalPurchases: number;          // count of completed Purchase entries
  totalSpentCents: number;         // sum of amountPaid across completed purchases
  revealsAllowed: number;          // remaining at time of deletion
  revealsCreated: number;          // count at time of deletion
  enquiryCount: number;            // how many enquiries they had
  deletedBy: "user" | "admin";     // who triggered the delete
  deletedAt: Timestamp;            // when the delete happened
  purgeAt: Timestamp;              // deletedAt + 30 days
}

const COLLECTION = "deleted_users";
const RETENTION_DAYS = 30;

// ─── Build shadow record from user doc ──────────────────────

/**
 * Compute a shadow record from the user's Firestore doc + their enquiry count.
 * Pure helper — does not write to Firestore.
 */
export function buildShadowRecord(params: {
  user: FirestoreUser;
  enquiryCount: number;
  deletedBy: "user" | "admin";
}): Omit<DeletedUserRecord, "deletedAt" | "purgeAt"> {
  const { user, enquiryCount, deletedBy } = params;

  const completedPurchases: Purchase[] = (user.purchases ?? []).filter(
    (p) => p.status === "completed"
  );

  const totalSpentCents = completedPurchases.reduce(
    (sum, p) => sum + (p.amountPaid ?? 0),
    0
  );

  return {
    originalUid: user.uid,
    parentName: user.fullName || null,
    email: user.email || null,
    phoneNumber: user.phone || null,
    activePlan: user.activePlan && user.activePlan !== "none" ? user.activePlan : null,
    totalPurchases: completedPurchases.length,
    totalSpentCents,
    revealsAllowed: user.revealsAllowed ?? 0,
    revealsCreated: user.revealsCreated ?? 0,
    enquiryCount,
    deletedBy,
  };
}

// ─── Write shadow record to Firestore ───────────────────────

/**
 * Write a shadow record for a deleted user.
 * Sets purgeAt to deletedAt + 30 days.
 *
 * If a shadow record already exists for this UID (e.g. user was admin-deleted
 * then somehow re-deleted), it gets overwritten with fresh timestamps.
 */
export async function writeShadowRecord(
  shadow: Omit<DeletedUserRecord, "deletedAt" | "purgeAt">
): Promise<void> {
  const db = getAdminDb();
  const now = Timestamp.now();
  const purgeAtMs = now.toMillis() + RETENTION_DAYS * 24 * 60 * 60 * 1000;

  await db.collection(COLLECTION).doc(shadow.originalUid).set({
    ...shadow,
    deletedAt: now,
    purgeAt: Timestamp.fromMillis(purgeAtMs),
  });
}

// ─── List shadow records (admin only — uses Admin SDK) ──────

/**
 * Fetch all shadow records, ordered by most-recently-deleted first.
 * Used by the admin panel.
 */
export async function listShadowRecords(): Promise<DeletedUserRecord[]> {
  const db = getAdminDb();
  const snap = await db
    .collection(COLLECTION)
    .orderBy("deletedAt", "desc")
    .get();

  return snap.docs.map((d) => d.data() as DeletedUserRecord);
}

// ─── Purge expired shadow records ───────────────────────────

export interface PurgeResult {
  scanned: number;
  purged: number;
  errors: string[];
}

/**
 * Delete every shadow record whose purgeAt is in the past.
 * Called by the daily cron job.
 *
 * Errors during individual deletes are collected (not thrown) so one bad
 * record doesn't stop the rest of the purge.
 */
export async function purgeExpiredShadowRecords(): Promise<PurgeResult> {
  const result: PurgeResult = { scanned: 0, purged: 0, errors: [] };
  const db = getAdminDb();
  const now = Timestamp.now();

  const snap = await db
    .collection(COLLECTION)
    .where("purgeAt", "<=", now)
    .get();

  result.scanned = snap.size;

  // Use a batch for efficiency, but cap at 500 (Firestore batch limit)
  // For a small site we'll never hit this; safety guard for the future.
  const docs = snap.docs;
  const BATCH_SIZE = 500;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const slice = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    slice.forEach((d) => batch.delete(d.ref));
    try {
      await batch.commit();
      result.purged += slice.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Batch ${i / BATCH_SIZE} failed: ${msg}`);
    }
  }

  return result;
}

// ─── Constants exported for testing / docs ──────────────────

export { COLLECTION as DELETED_USERS_COLLECTION, RETENTION_DAYS };
