"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

type ToastType = "success" | "error" | "info";

function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  const colors = { success: "#22c55e", error: "#ef4444", info: "#3b82f6" };
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999,
      background: "#1f2937", borderLeft: `4px solid ${colors[type]}`,
      borderRadius: 8, padding: "14px 18px", maxWidth: 380,
      display: "flex", alignItems: "flex-start", gap: 10,
      boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
      fontFamily: "system-ui, sans-serif", fontSize: 14,
      animation: "slideIn .3s ease-out",
    }}>
      <span style={{ color: colors[type], fontWeight: 700, flexShrink: 0 }}>
        {type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}
      </span>
      <span style={{ color: "#f9fafb", lineHeight: 1.5, flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 16 }}>×</button>
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
    setTimeout(() => setToast(null), 5000);
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

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) { showToast("Please enter a valid email address.", "error"); return; }
    if (!password) { showToast("Please enter your password.", "error"); return; }

    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      showToast("Signed in successfully!", "success");
      setTimeout(() => router.push(redirectTo), 1000);
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
        showToast("Account created! Please complete your profile.", "success");
        setTimeout(() => router.push("/complete-profile"), 1000);
      } else {
        showToast("Signed in successfully!", "success");
        setTimeout(() => router.push(redirectTo), 1000);
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
        body { font-family: system-ui, -apple-system, sans-serif; background: #f9fafb; }
        .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: #f3f4f6; }
        .auth-card { background: white; border-radius: 16px; padding: 40px; width: 100%; max-width: 420px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .auth-logo { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 8px; }
        .auth-subtitle { font-size: 14px; color: #6b7280; margin-bottom: 32px; }
        .form-group { margin-bottom: 16px; }
        .form-label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px; }
        .form-input { width: 100%; padding: 11px 14px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; color: #111827; outline: none; transition: border-color .2s; background: white; }
        .form-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .password-wrap { position: relative; }
        .password-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #6b7280; font-size: 13px; padding: 4px; }
        .btn-primary { width: 100%; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background .2s; margin-top: 4px; }
        .btn-primary:hover:not(:disabled) { background: #1d4ed8; }
        .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
        .btn-google { width: 100%; padding: 12px; background: white; color: #374151; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all .2s; display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 20px; }
        .btn-google:hover:not(:disabled) { background: #f9fafb; border-color: #d1d5db; }
        .btn-google:disabled { opacity: .5; cursor: not-allowed; }
        .divider { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .divider-line { flex: 1; height: 1px; background: #e5e7eb; }
        .divider-text { font-size: 12px; color: #9ca3af; font-weight: 500; }
        .auth-link { color: #2563eb; text-decoration: none; font-weight: 500; }
        .auth-link:hover { text-decoration: underline; }
        .auth-footer { text-align: center; font-size: 13px; color: #6b7280; margin-top: 24px; }
        .forgot-link { display: block; text-align: right; font-size: 13px; margin-bottom: 16px; }
        .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.3); border-top-color: white; border-radius: 50%; animation: spin .7s linear infinite; vertical-align: middle; margin-right: 8px; }
        .spinner-dark { border-color: rgba(55,65,81,.2); border-top-color: #374151; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">VGR Studio</div>
          <p className="auth-subtitle">Sign in to your account</p>

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
              <label className="form-label">Email Address</label>
              <input
                className="form-input"
                type="text"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="password-wrap">
                <input
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
                >
                  {showPassword ? "Hide" : "Show"}
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
            <a href="/signup" className="auth-link">Create account</a>
          </div>
        </div>
      </div>
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
