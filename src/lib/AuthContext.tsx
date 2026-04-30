"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendEmailVerification,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  linkWithCredential,
  fetchSignInMethodsForEmail,
  updateProfile,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  createUserDoc,
  getUserDoc,
  updateLastLogin,
  updateUserProvider,
  updateUserPhone,
  markEmailVerified,
  userDocExists,
  FirestoreUser,
} from "@/lib/userService";

// ── Types ────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  firestoreUser: FirestoreUser | null;
  loading: boolean;
  // Email/Password
  signUpWithEmail: (email: string, password: string, fullName: string, phone: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  // Google
  signInWithGoogle: () => Promise<{ isNewUser: boolean }>;
  // Complete Profile (after Google signup)
  completeGoogleProfile: (phone: string, password: string) => Promise<void>;
  // Password reset
  resetPassword: (email: string) => Promise<void>;
  // Sign out
  logout: () => Promise<void>;
  // Delete account (self)
  deleteAccount: (credential?: { type: "email"; password: string } | { type: "google" }) => Promise<void>;
  // Refresh firestore user
  refreshFirestoreUser: () => Promise<void>;
}

// ── Context ──────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────

async function fireEmailEvent(payload: Record<string, string>): Promise<void> {
  await fetch("/api/email-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firestoreUser, setFirestoreUser] = useState<FirestoreUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase Auth state
  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const fsUser = await getUserDoc(firebaseUser.uid);
          setFirestoreUser(fsUser);
          // Auto-mark email as verified if Firebase says so
          if (firebaseUser.emailVerified && fsUser && !fsUser.emailVerified) {
            await markEmailVerified(firebaseUser.uid);
          }
        } catch (e) {
          console.error("Error fetching Firestore user:", e);
        }
      } else {
        setFirestoreUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Sign Up with Email/Password ──────────────────────────

  async function signUpWithEmail(
    email: string,
    password: string,
    fullName: string,
    phone: string
  ): Promise<void> {
    const auth = getFirebaseAuth();

    // Check if email already exists
    const methods = await fetchSignInMethodsForEmail(auth, email);
    if (methods.length > 0) {
      throw new Error("An account with this email already exists. Please sign in.");
    }

    // Create Firebase Auth account
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const { user: newUser } = cred;

    // Update display name
    await updateProfile(newUser, { displayName: fullName });

    // Send email verification
    await sendEmailVerification(newUser);

    // Create Firestore user doc
    await createUserDoc({
      uid: newUser.uid,
      fullName,
      email,
      phone,
      provider: "email",
      emailVerified: false,
    });

    // Trigger welcome email (non-blocking)
    void fireEmailEvent({
      type: "signup",
      email: email.trim().toLowerCase(),
      fullName: fullName.trim(),
    }).catch((err) => console.error("[auth] welcome email event failed:", err));

    // Update state
    const fsUser = await getUserDoc(newUser.uid);
    setFirestoreUser(fsUser);
  }

  // ── Sign In with Email/Password ──────────────────────────

  async function signInWithEmail(email: string, password: string): Promise<void> {
    const auth = getFirebaseAuth();
    const cred = await signInWithEmailAndPassword(auth, email, password);

    // Ensure Firestore doc exists (defensive)
    const exists = await userDocExists(cred.user.uid);
    if (!exists) {
      await createUserDoc({
        uid: cred.user.uid,
        fullName: cred.user.displayName || email.split("@")[0],
        email,
        provider: "email",
        emailVerified: cred.user.emailVerified,
      });
    }

    // Update last login
    await updateLastLogin(cred.user.uid);
    const fsUser = await getUserDoc(cred.user.uid);
    setFirestoreUser(fsUser);
  }

  // ── Sign In / Sign Up with Google ────────────────────────

  async function signInWithGoogle(): Promise<{ isNewUser: boolean }> {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    const cred = await signInWithPopup(auth, provider);
    const { user: googleUser } = cred;
    const email = googleUser.email!;

    // Check if Firestore doc exists
    const exists = await userDocExists(googleUser.uid);

    if (!exists) {
      // NEW Google user — create minimal Firestore doc (phone/password added in complete-profile)
      await createUserDoc({
        uid: googleUser.uid,
        fullName: googleUser.displayName || email.split("@")[0],
        email,
        phone: "",
        provider: "google",
        emailVerified: true, // Google emails are pre-verified
      });
      const fsUser = await getUserDoc(googleUser.uid);
      setFirestoreUser(fsUser);
      return { isNewUser: true };
    }

    // EXISTING user — update last login
    await updateLastLogin(googleUser.uid);
    const fsUser = await getUserDoc(googleUser.uid);
    setFirestoreUser(fsUser);
    return { isNewUser: false };
  }

  // ── Complete Google Profile (link email/password) ────────

  async function completeGoogleProfile(phone: string, password: string): Promise<void> {
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      throw new Error("No authenticated user found.");
    }

    // Link email/password credential to Google account
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await linkWithCredential(currentUser, credential);

    // Update Firestore
    await updateUserPhone(currentUser.uid, phone);
    await updateUserProvider(currentUser.uid, "both");

    // Refresh state
    const fsUser = await getUserDoc(currentUser.uid);
    setFirestoreUser(fsUser);
  }

  // ── Reset Password ───────────────────────────────────────

  async function resetPassword(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const res = await fetch("/api/email-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "forgot_password", email: normalized }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to send reset email." }));
      throw new Error(data.error || "Failed to send reset email.");
    }
  }

  // ── Logout ───────────────────────────────────────────────

  async function logout(): Promise<void> {
    const auth = getFirebaseAuth();
    await signOut(auth);
    setFirestoreUser(null);
  }

  // ── Delete Account (self) ─────────────────────────────────

  async function deleteAccount(
    credential?: { type: "email"; password: string } | { type: "google" }
  ): Promise<void> {
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("No authenticated user.");

    // Re-authenticate before deletion (Firebase security requirement)
    if (credential?.type === "email") {
      const emailCred = EmailAuthProvider.credential(
        currentUser.email!,
        credential.password
      );
      await reauthenticateWithCredential(currentUser, emailCred);
    } else if (credential?.type === "google") {
      const provider = new GoogleAuthProvider();
      await reauthenticateWithPopup(currentUser, provider);
    }

    // Call server-side delete endpoint — it handles:
    //  - Deleting all the user's enquiry photos from Storage
    //  - Deleting all their enquiry docs
    //  - Deleting their secure-genders docs
    //  - Deleting their user doc
    //  - Deleting their Firebase Auth user
    // Re-auth above is required because Firebase only gives us a fresh ID token
    // if the user recently re-authenticated.
    const idToken = await currentUser.getIdToken(/* forceRefresh */ true);
    const res = await fetch("/api/delete-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Delete failed." }));
      throw new Error(data.error || "Failed to delete account.");
    }

    // Sign out locally — the Auth user is already deleted server-side
    await signOut(auth);
    setFirestoreUser(null);
  }

  // ── Refresh Firestore User ───────────────────────────────

  async function refreshFirestoreUser(): Promise<void> {
    if (!user) return;
    const fsUser = await getUserDoc(user.uid);
    setFirestoreUser(fsUser);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        firestoreUser,
        loading,
        signUpWithEmail,
        signInWithEmail,
        signInWithGoogle,
        completeGoogleProfile,
        resetPassword,
        logout,
        deleteAccount,
        refreshFirestoreUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
