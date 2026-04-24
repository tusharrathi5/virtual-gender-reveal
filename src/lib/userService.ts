import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
 
// ── Types ────────────────────────────────────────────────────
 
export type UserRole = "user" | "admin";
export type UserProvider = "email" | "google" | "both";
export type ActivePlan = "none" | "free" | "premium" | "custom";
export type PurchaseStatus = "completed" | "refunded" | "disputed";

export interface Purchase {
  purchaseId: string;
  plan: "free" | "premium" | "custom";
  purchasedAt: Timestamp | null;
  amountPaid: number;           // cents; 0 for free
  currency: string;             // e.g. "usd"
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  status: PurchaseStatus;
  revealsGranted: number;       // usually 1
  revealEnquiryId: string | null; // null until the user creates a reveal using this purchase
}
 
export interface FirestoreUser {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  provider: UserProvider;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  lastLogin: Timestamp | null;
  isDeleted: boolean;
  emailVerified: boolean;

  // Entitlements
  activePlan: ActivePlan;        // most recent plan; "none" until first purchase
  revealsAllowed: number;        // unused reveals the user can still create
  revealsCreated: number;        // how many reveals they've created (all-time)
  purchases: Purchase[];         // full purchase history
}
 
// ── Create User Doc ──────────────────────────────────────────
 
export async function createUserDoc(data: {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  role?: UserRole;
  provider: UserProvider;
  emailVerified?: boolean;
}): Promise<void> {
  const db = getFirebaseDb();
  const userRef = doc(db, "users", data.uid);
 
await setDoc(userRef, {
    uid: data.uid,
    fullName: data.fullName,
    email: data.email.toLowerCase(),
    phone: data.phone || "",
    role: data.role || "user",
    provider: data.provider,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    isDeleted: false,
    emailVerified: data.emailVerified || false,
    // Entitlements — user starts with no plan, no reveals
    activePlan: "none",
    revealsAllowed: 0,
    revealsCreated: 0,
    purchases: [],
  });
}
 
// ── Get User Doc ─────────────────────────────────────────────
 
export async function getUserDoc(uid: string): Promise<FirestoreUser | null> {
  const db = getFirebaseDb();
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  return snap.data() as FirestoreUser;
}
 
// ── Get User by Email ────────────────────────────────────────
 
export async function getUserByEmail(email: string): Promise<FirestoreUser | null> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, "users"),
    where("email", "==", email.toLowerCase()),
    where("isDeleted", "==", false)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as FirestoreUser;
}
 
// ── Update User Doc ──────────────────────────────────────────
 
export async function updateUserDoc(
  uid: string,
  data: Partial<Omit<FirestoreUser, "uid" | "createdAt">>
): Promise<void> {
  const db = getFirebaseDb();
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}
 
// ── Update Last Login ────────────────────────────────────────
 
export async function updateLastLogin(uid: string): Promise<void> {
  const db = getFirebaseDb();
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    lastLogin: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
 
// ── Soft Delete User Doc ─────────────────────────────────────
 
export async function softDeleteUserDoc(uid: string): Promise<void> {
  const db = getFirebaseDb();
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    isDeleted: true,
    updatedAt: serverTimestamp(),
  });
}
 
// ── Hard Delete User Doc ─────────────────────────────────────
 
export async function deleteUserDoc(uid: string): Promise<void> {
  const db = getFirebaseDb();
  const userRef = doc(db, "users", uid);
  await deleteDoc(userRef);
}
 
// ── Update Provider ──────────────────────────────────────────
 
export async function updateUserProvider(
  uid: string,
  provider: UserProvider
): Promise<void> {
  await updateUserDoc(uid, { provider });
}
 
// ── Update Phone ─────────────────────────────────────────────
 
export async function updateUserPhone(uid: string, phone: string): Promise<void> {
  await updateUserDoc(uid, { phone });
}
 
// ── Mark Email Verified ───────────────────────────────────────
 
export async function markEmailVerified(uid: string): Promise<void> {
  await updateUserDoc(uid, { emailVerified: true });
}
 
// ── Check if Firestore User Exists ───────────────────────────

export async function userDocExists(uid: string): Promise<boolean> {
  const db = getFirebaseDb();
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  return snap.exists();
}

// ── Entitlement Helpers ─────────────────────────────────────

/**
 * Check if a user is entitled to create a reveal (has revealsAllowed > 0).
 * Fetches fresh data — do NOT use cached state for gating checks.
 */
export async function canCreateReveal(uid: string): Promise<boolean> {
  const user = await getUserDoc(uid);
  if (!user) return false;
  if (user.isDeleted) return false;
  return (user.revealsAllowed || 0) > 0;
}

/**
 * Find the oldest unconsumed purchase for this user.
 * Returns null if no unused purchase exists.
 */
export async function findUnusedPurchase(uid: string): Promise<Purchase | null> {
  const user = await getUserDoc(uid);
  if (!user || !user.purchases) return null;

  // Sort ascending by purchase date, find first one with no revealEnquiryId
  const sorted = [...user.purchases].sort((a, b) => {
    const ta = a.purchasedAt?.toMillis?.() ?? 0;
    const tb = b.purchasedAt?.toMillis?.() ?? 0;
    return ta - tb;
  });

  return (
    sorted.find(
      (p) =>
        p.status === "completed" &&
        p.revealEnquiryId === null &&
        p.revealsGranted > 0
    ) ?? null
  );
}

/**
 * Consume the oldest unused purchase by attaching it to a new reveal.
 * Decrements revealsAllowed, increments revealsCreated.
 * Throws if no unused purchase exists.
 */
export async function consumePurchaseForReveal(
  uid: string,
  enquiryId: string
): Promise<void> {
  const db = getFirebaseDb();
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error("User not found");

  const user = snap.data() as FirestoreUser;
  const purchases = [...(user.purchases || [])];

  // Find oldest unconsumed, completed purchase
  const sorted = purchases
    .map((p, idx) => ({ p, idx }))
    .sort((a, b) => {
      const ta = a.p.purchasedAt?.toMillis?.() ?? 0;
      const tb = b.p.purchasedAt?.toMillis?.() ?? 0;
      return ta - tb;
    });

  const target = sorted.find(
    ({ p }) =>
      p.status === "completed" &&
      p.revealEnquiryId === null &&
      p.revealsGranted > 0
  );

  if (!target) {
    throw new Error("No unused purchase available — user needs to buy a plan first.");
  }

  // Attach enquiry to this purchase
  purchases[target.idx] = {
    ...purchases[target.idx],
    revealEnquiryId: enquiryId,
  };

  await updateDoc(userRef, {
    purchases,
    revealsAllowed: Math.max(0, (user.revealsAllowed || 0) - 1),
    revealsCreated: (user.revealsCreated || 0) + 1,
    updatedAt: serverTimestamp(),
  });
}
 
