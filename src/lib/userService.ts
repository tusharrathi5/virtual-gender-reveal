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
 
