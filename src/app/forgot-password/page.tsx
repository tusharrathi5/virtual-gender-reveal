"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";

function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email.trim());
}

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isValidEmail(email)) { setError("Please enter a valid email address."); return; }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send reset email.";
      if (msg.includes("user-not-found")) {
        setError("No account found with this email address.");
      } else {
        setError(msg.replace("Firebase: ", "").replace(/\s*\(auth\/.*?\)\.?/, "").trim());
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        * { box-sizing:border-box; margin:0; padding:0; }
        .auth-page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; background:#f3f4f6; }
        .auth-card { background:white; border-radius:16px; padding:40px; width:100%; max-width:420px; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
        .auth-logo { font-size:22px; font-weight:700; color:#111827; margin-bottom:8px; }
        .auth-subtitle { font-size:14px; color:#6b7280; margin-bottom:32px; line-height:1.5; }
        .form-group { margin-bottom:20px; }
        .form-label { display:block; font-size:13px; font-weight:500; color:#374151; margin-bottom:6px; }
        .form-input { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:8px; font-size:14px; color:#111827; outline:none; transition:border-color .2s; }
        .form-input:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.1); }
        .btn-primary { width:100%; padding:12px; background:#2563eb; color:white; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; transition:background .2s; }
        .btn-primary:hover:not(:disabled) { background:#1d4ed8; }
        .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
        .error-box { background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px 14px; color:#dc2626; font-size:13px; margin-bottom:16px; }
        .success-box { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:20px; text-align:center; }
        .success-icon { font-size:40px; margin-bottom:12px; display:block; }
        .success-title { font-size:18px; font-weight:600; color:#166534; margin-bottom:8px; }
        .success-text { font-size:14px; color:#15803d; line-height:1.5; }
        .back-link { display:block; text-align:center; margin-top:24px; font-size:13px; color:#2563eb; text-decoration:none; }
        .back-link:hover { text-decoration:underline; }
        .spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,.3); border-top-color:white; border-radius:50%; animation:spin .7s linear infinite; vertical-align:middle; margin-right:8px; }
      `}</style>

      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">VGR Studio</div>
          <p className="auth-subtitle">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>

          {!sent ? (
            <>
              {error && <div className="error-box">⚠ {error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
                <button className="btn-primary" type="submit" disabled={loading}>
                  {loading ? <><span className="spinner" />Sending...</> : "Send Reset Email"}
                </button>
              </form>
            </>
          ) : (
            <div className="success-box">
              <span className="success-icon">📧</span>
              <div className="success-title">Check your email</div>
              <p className="success-text">
                We sent a password reset link to <strong>{email}</strong>.<br />
                Check your inbox and follow the instructions.
              </p>
            </div>
          )}

          <a href="/login" className="back-link">← Back to Sign In</a>
        </div>
      </div>
    </>
  );
}
