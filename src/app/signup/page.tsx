"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { AuthModalShell } from "@/components/auth/AuthModalShell";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";

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

export default function SignupPage() {
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  function showToast(message: string, type: ToastType) {
    setToast({ message, type });
  }

  function getAuthError(err: unknown): string {
    const msg = err instanceof Error ? err.message : "Something went wrong";
    if (msg.includes("email-already-in-use") || msg.includes("already exists"))
      return "An account with this email already exists. Please sign in instead.";
    if (msg.includes("weak-password")) return "Password must be at least 6 characters.";
    if (msg.includes("invalid-email")) return "Please enter a valid email address.";
    if (msg.includes("network-request-failed")) return "Network error. Check your connection.";
    return msg.replace("Firebase: ", "").replace(/\s*\(auth\/.*?\)\.?/, "").trim();
  }

  async function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { showToast("Please enter your full name.", "error"); return; }
    if (!isValidEmail(email)) { showToast("Please enter a valid email (e.g. name@example.com).", "error"); return; }
    if (password.length < 6) { showToast("Password must be at least 6 characters.", "error"); return; }
    if (password !== confirmPassword) { showToast("Passwords do not match.", "error"); return; }

    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password, fullName.trim());
      showToast("Account created! Please check your email to verify your account.", "success");
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err) {
      showToast(getAuthError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      showToast("Account created! Redirecting to your dashboard.", "success");
      setTimeout(() => router.push("/dashboard"), 1000);
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
        .input-icon { position: absolute; left: 16px; width: 18px; height: 18px; color: #9ca3af; pointer-events: none; }
        
        .form-input { 
          width: 100%; 
          padding: 13px 16px 13px 46px; 
          border: 1.5px solid #f1f1f5; 
          border-radius: 14px; 
          font-size: 14px; 
          color: #111827; 
          outline: none; 
          transition: all .2s; 
          background: white; 
          font-weight: 500;
        }
        .form-input::placeholder { color: #9ca3af; font-weight: 500; }
        .form-input:focus { 
          border-color: #E8449A; 
          box-shadow: 0 0 0 4px rgba(232, 68, 154, 0.08); 
        }
        .form-input:disabled { background: #fafafd; color: #9ca3af; }
        
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
          transition: all .2s; 
          margin-top: 6px; 
          box-shadow: 0 4px 12px rgba(232, 68, 154, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .btn-primary:hover:not(:disabled) { 
          opacity: 0.95; 
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(232, 68, 154, 0.2);
        }
        .btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }
        .btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; box-shadow: none; }
        
        .btn-google { 
          width: 100%; 
          padding: 13px; 
          background: white; 
          color: #374151; 
          border: 1.5px solid #f1f1f5; 
          border-radius: 9999px; 
          font-size: 14px; 
          font-weight: 700; 
          cursor: pointer; 
          transition: all .2s; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          gap: 10px; 
          margin-bottom: 24px; 
        }
        .btn-google:hover:not(:disabled) { 
          background: #fafafd; 
          border-color: #d1d5db; 
        }
        .btn-google:disabled { opacity: .5; cursor: not-allowed; }
        
        .divider { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
        .divider-line { flex: 1; height: 1px; background: #f1f1f5; }
        .divider-text { font-size: 11px; color: #9ca3af; font-weight: 700; letter-spacing: 0.10em; }
        
        .auth-link { color: #E8449A; text-decoration: none; font-weight: 700; transition: color 0.2s; }
        .auth-link:hover { color: #c2527a; text-decoration: underline; }
        .auth-link-button { border: 0; background: transparent; padding: 0; cursor: pointer; font: inherit; }
        .auth-footer { text-align: center; font-size: 13px; color: #6b7280; margin-top: 28px; font-weight: 600; }
        
        .password-strength { font-size: 12px; margin-top: 6px; font-weight: 600; }
        .strength-weak { color: #ef4444; }
        .strength-ok { color: #f59e0b; }
        .strength-strong { color: #22c55e; }
        
        .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.3); border-top-color: white; border-radius: 50%; animation: spin .7s linear infinite; vertical-align: middle; }
        .spinner-dark { border-color: rgba(55,65,81,.2); border-top-color: #374151; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <AuthModalShell title="Create your account" subtitle="Join VGR Studio and create a reveal your loved ones will remember." submitting={isLoading}>
        {/* Google Sign Up */}
        <button className="btn-google" onClick={handleGoogleSignup} disabled={isLoading}>
          {googleLoading ? (
            <><span className="spinner spinner-dark" />Connecting...</>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign up with Google
            </>
          )}
        </button>

        <div className="divider">
          <div className="divider-line" />
          <span className="divider-text">OR</span>
          <div className="divider-line" />
        </div>

        <form onSubmit={handleSignupSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name-input">Full Name</label>
            <div className="input-with-icon">
              <User className="input-icon" />
              <input
                id="name-input"
                className="form-input"
                type="text"
                placeholder="Sarah & James"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

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
                placeholder="Min. 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
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
            {password && (
              <div className={`password-strength ${password.length < 6 ? "strength-weak" : password.length < 10 ? "strength-ok" : "strength-strong"}`}>
                {password.length < 6 ? "Weak" : password.length < 10 ? "Moderate" : "Strong"} password
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirm-input">Confirm Password</label>
            <div className="input-with-icon">
              <Lock className="input-icon" />
              <input
                id="confirm-input"
                className="form-input"
                type={showConfirm ? "text" : "password"}
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                style={{ paddingRight: 44, borderColor: confirmPassword && confirmPassword !== password ? "#ef4444" : undefined }}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== password && (
              <div className="password-strength strength-weak">Passwords do not match</div>
            )}
          </div>

          <button className="btn-primary" type="submit" disabled={isLoading}>
            {loading ? <><span className="spinner" />Creating account...</> : "Create Account"}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{" "}
          <button type="button" className="auth-link auth-link-button" onClick={() => router.replace("/login")} disabled={isLoading}>Sign in</button>
        </div>
      </AuthModalShell>
    </>
  );
}
