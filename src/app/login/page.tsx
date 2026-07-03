"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { AuthModalShell } from "@/components/auth/AuthModalShell";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

type ToastType = "success" | "error" | "info";

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: ToastType;
  onClose: () => void;
}) {
  const colors = {
    success: "border-green-500 bg-green-50 text-green-800",
    error: "border-red-500 bg-red-50 text-red-800",
    info: "border-blue-500 bg-blue-50 text-blue-800",
  };

  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed top-20 right-6 z-[9999] border-l-4 rounded-xl p-4 shadow-lg flex items-center justify-between gap-4 max-w-sm md:max-w-md animate-slide-in font-medium text-sm ${colors[type]}`}
      role="alert"
    >
      <div className="flex items-center gap-2">
        <span className="font-bold text-xs uppercase bg-white/70 px-2 py-0.5 rounded-full shrink-0">
          {type === "success" ? "✓" : type === "error" ? "!" : "i"}
        </span>
        <span>{message}</span>
      </div>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-800 font-bold text-lg leading-none shrink-0"
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}

function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email.trim());
}

function LoginContent() {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  function showToast(message: string, type: ToastType) {
    setToast({ message, type });
  }

  function getAuthError(err: unknown): string {
    const msg = err instanceof Error ? err.message : "Something went wrong";
    if (msg.includes("user-not-found") || msg.includes("invalid-credential") || msg.includes("INVALID_LOGIN_CREDENTIALS"))
      return "Invalid email or password. Please try again.";
    if (msg.includes("wrong-password")) return "Incorrect password.";
    if (msg.includes("too-many-requests")) return "Too many attempts. Please wait before trying again.";
    if (msg.includes("user-disabled")) return "This account has been disabled. Contact support.";
    if (msg.includes("network-request-failed")) return "Network error. Check your connection.";
    return msg.replace("Firebase: ", "").replace(/\s*\(auth\/.*?\)\.?/, "").trim();
  }

  async function getRedirectForUser(): Promise<string> {
    const auth = getAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) return redirectTo;
    try {
      const db = getFirebaseDb();
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists() && userDoc.data().role === "admin") {
        return "/admin";
      }
    } catch (err) {
      console.error("[login] Failed to check admin role:", err);
    }
    return redirectTo;
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) { showToast("Please enter a valid email address.", "error"); return; }
    if (!password) { showToast("Please enter your password.", "error"); return; }

    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      showToast("Signed in successfully!", "success");
      const target = await getRedirectForUser();
      setTimeout(() => router.push(target), 1000);
    } catch (err) {
      showToast(getAuthError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      const { isNewUser } = await signInWithGoogle();
      if (isNewUser) {
        showToast("Account created! Redirecting to your dashboard.", "success");
        setTimeout(() => router.push("/dashboard"), 1000);
      } else {
        showToast("Signed in successfully!", "success");
        const target = await getRedirectForUser();
        setTimeout(() => router.push(target), 1000);
      }
    } catch (err) {
      showToast(getAuthError(err), "error");
    } finally {
      setGoogleLoading(false);
    }
  }

  const isLoading = loading || googleLoading;

  return (
    <>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #fafafd; }
        
        .form-group { margin-bottom: 20px; }
        .form-label { display: block; font-size: 11px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
        
        .input-with-icon { position: relative; display: flex; align-items: center; width: 100%; }
        .input-icon { position: absolute; left: 16px; width: 18px; height: 18px; color: #9ca3af; pointer-events: none; transition: color 0.2s; }
        
        .form-input { 
          width: 100%; 
          padding: 13px 16px 13px 46px; 
          border: 1.5px solid rgba(229, 231, 235, 0.8); 
          border-radius: 14px; 
          font-size: 14px; 
          color: #111827; 
          outline: none; 
          transition: all .2s cubic-bezier(0.16, 1, 0.3, 1); 
          background: rgba(255, 255, 255, 0.7); 
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          font-weight: 500;
        }
        .form-input::placeholder { color: #9ca3af; font-weight: 500; }
        .form-input:focus { 
          border-color: #E8449A; 
          background: white;
          box-shadow: 0 0 0 4px rgba(232, 68, 154, 0.12); 
        }
        .form-input:focus ~ .input-icon {
          color: #E8449A;
        }
        
        .password-toggle { 
          position: absolute; 
          right: 14px; 
          background: none; 
          border: none; 
          cursor: pointer; 
          color: #9ca3af; 
          padding: 6px; 
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s;
        }
        .password-toggle:hover {
          color: #374151;
          background: #fafafd;
        }
        
        .btn-primary { 
          width: 100%; 
          padding: 14px; 
          background: linear-gradient(135deg, #E8449A 0%, #3A9FE8 100%); 
          color: white; 
          border: none; 
          border-radius: 9999px; 
          font-size: 14px; 
          font-weight: 700; 
          cursor: pointer; 
          transition: all .25s cubic-bezier(0.16, 1, 0.3, 1); 
          margin-top: 6px; 
          box-shadow: 0 4px 12px rgba(232, 68, 154, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .btn-primary:hover:not(:disabled) { 
          transform: translateY(-1.5px) scale(1.01);
          box-shadow: 0 6px 20px rgba(232, 68, 154, 0.35);
        }
        .btn-primary:active:not(:disabled) {
          transform: translateY(0) scale(1);
        }
        .btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; box-shadow: none; }
        
        .btn-google { 
          width: 100%; 
          padding: 13px; 
          background: rgba(255, 255, 255, 0.85); 
          color: #374151; 
          border: 1.5px solid rgba(229, 231, 235, 0.8); 
          border-radius: 9999px; 
          font-size: 14px; 
          font-weight: 700; 
          cursor: pointer; 
          transition: all .25s cubic-bezier(0.16, 1, 0.3, 1); 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          gap: 10px; 
          margin-bottom: 24px; 
          box-shadow: 0 2px 6px rgba(0,0,0,0.02);
        }
        .btn-google:hover:not(:disabled) { 
          background: white; 
          border-color: #d1d5db; 
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.06);
        }
        .btn-google:active:not(:disabled) {
          transform: translateY(0);
        }
        .btn-google:disabled { opacity: .5; cursor: not-allowed; }
        
        .divider { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
        .divider-line { flex: 1; height: 1px; background: #f1f1f5; }
        .divider-text { font-size: 11px; color: #9ca3af; font-weight: 700; letter-spacing: 0.10em; }
        
        .auth-link { color: #E8449A; text-decoration: none; font-weight: 700; transition: color 0.2s; }
        .auth-link:hover { color: #c2527a; text-decoration: underline; }
        .auth-link-button { border: 0; background: transparent; padding: 0; cursor: pointer; font: inherit; }
        .auth-footer { text-align: center; font-size: 13px; color: #6b7280; margin-top: 28px; font-weight: 600; }
        .forgot-link { display: block; text-align: right; font-size: 13px; margin-bottom: 20px; }
        
        .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.3); border-top-color: white; border-radius: 50%; animation: spin .7s linear infinite; vertical-align: middle; }
        .spinner-dark { border-color: rgba(55,65,81,.2); border-top-color: #374151; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <AuthModalShell title="Welcome back!" subtitle="Sign in to your VGR Studio account" submitting={isLoading}>
        {/* Google Sign In */}
        <button className="btn-google" onClick={handleGoogleLogin} disabled={isLoading}>
          {googleLoading ? (
            <><span className="spinner spinner-dark" />Signing in...</>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <div className="divider">
          <div className="divider-line" />
          <span className="divider-text">OR</span>
          <div className="divider-line" />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="email-input">Email Address</label>
            <div className="input-with-icon">
              <Mail className="input-icon" />
              <input
                id="email-input"
                className="form-input"
                type="text"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">Password</label>
            <div className="input-with-icon">
              <Lock className="input-icon" />
              <input
                id="password-input"
                className="form-input"
                type={showPassword ? "text" : "password"}
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <a href="/forgot-password" className="auth-link forgot-link">Forgot password?</a>

          <button className="btn-primary" type="submit" disabled={isLoading}>
            {loading ? <><span className="spinner" />Signing in...</> : "Sign In"}
          </button>
        </form>

        <div className="auth-footer">
          Don&apos;t have an account?{" "}
          <button type="button" className="auth-link auth-link-button" onClick={() => router.replace(`/signup?redirect=${encodeURIComponent(redirectTo)}`)} disabled={isLoading}>Create account</button>
        </div>
      </AuthModalShell>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f3f4f6" }} />}>
      <LoginContent />
    </Suspense>
  );
}
