"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { getFirebaseAuth } from "@/lib/firebase";
import { ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

type ToastType = "success" | "error" | "info";

function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  const colors = { success: "#22c55e", error: "#ef4444", info: "#3b82f6" };
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999,
      background: "#1f2937", borderLeft: `4px solid ${colors[type]}`,
      borderRadius: 8, padding: "14px 18px", maxWidth: 400,
      display: "flex", alignItems: "flex-start", gap: 10,
      boxShadow: "0 10px 30px rgba(0,0,0,0.3)", fontFamily: "system-ui, sans-serif",
      fontSize: 14, animation: "slideIn .3s ease-out",
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

function isValidPhone(phone: string): boolean {
  return /^\+?[\d\s\-().]{7,20}$/.test(phone) && phone.replace(/\D/g, "").length >= 7;
}

type SignupStep = "details" | "otp";
const COUNTRY_CODES = ["+1", "+44", "+61", "+91", "+971", "+65"];

export default function SignupPage() {
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<SignupStep>("details");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);


  useEffect(() => {
    try {
      const auth = getFirebaseAuth();
      const w = window as unknown as { recaptchaVerifier?: RecaptchaVerifier };
      if (w.recaptchaVerifier) return;

      const container = document.getElementById("recaptcha-container");
      if (!container) return;

      w.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "normal" });
    } catch (err) {
      console.error("[signup] reCAPTCHA init failed:", err);
      showToast("Phone verification is temporarily unavailable. Please refresh and try again.", "error");
    }
  }, []);

  function fullPhoneE164(): string {
    const digits = phone.replace(/\D/g, "");
    return `${countryCode}${digits}`;
  }
  function showToast(message: string, type: ToastType) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 6000);
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

  async function sendOtpFlow(): Promise<boolean> {
    const normalizedPhone = fullPhoneE164();
    const limitRes = await fetch("/api/auth/otp-limit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalizedPhone, action: "check" }),
    });
    const limitData = await limitRes.json().catch(() => ({}));
    if (!limitRes.ok) {
      showToast(limitData?.error || "OTP limit reached.", "error");
      return false;
    }

    const auth = getFirebaseAuth();
    const verifier = (window as unknown as { recaptchaVerifier?: RecaptchaVerifier }).recaptchaVerifier;
    if (!verifier) { showToast("reCAPTCHA not ready. Refresh and try again.", "error"); return false; }
    const result = await signInWithPhoneNumber(auth, normalizedPhone, verifier);

    const consumeRes = await fetch("/api/auth/otp-limit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalizedPhone, action: "consume" }),
    });
    if (!consumeRes.ok) {
      const consumeData = await consumeRes.json().catch(() => ({}));
      showToast(consumeData?.error || "OTP limit reached.", "error");
      return false;
    }
    setConfirmationResult(result);
    showToast(`OTP sent to ${normalizedPhone}.`, "info");
    return true;
  }

  // Step 1: validate details, then go to OTP
  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { showToast("Please enter your full name.", "error"); return; }
    if (!isValidEmail(email)) { showToast("Please enter a valid email (e.g. name@example.com).", "error"); return; }
    if (!isValidPhone(phone)) { showToast("Please enter a valid phone number.", "error"); return; }
    if (password.length < 6) { showToast("Password must be at least 6 characters.", "error"); return; }
    if (password !== confirmPassword) { showToast("Passwords do not match.", "error"); return; }
    setSendingOtp(true);
    try {
      const ok = await sendOtpFlow();
      if (ok) setStep("otp");
    } catch (err) {
      showToast(getAuthError(err), "error");
    } finally {
      setSendingOtp(false);
    }
  }

  // Step 2: verify OTP and create account
  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) { showToast("Please enter the 6-digit OTP.", "error"); return; }
    if (!confirmationResult) { showToast("Please request OTP first.", "error"); return; }

    setLoading(true);
    try { await confirmationResult.confirm(otp); } catch { setLoading(false); showToast("Invalid OTP. Please try again.", "error"); return; }

    try {
      await signUpWithEmail(email.trim(), password, fullName.trim(), phone);
      showToast("Account created! Please check your email to verify your account.", "success");
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err) {
      showToast(getAuthError(err), "error");
      setStep("details"); // Go back to details on error
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setGoogleLoading(true);
    try {
      const { isNewUser } = await signInWithGoogle();
      if (isNewUser) {
        showToast("Google account connected! Please complete your profile.", "success");
        setTimeout(() => router.push("/complete-profile"), 1000);
      } else {
        showToast("Signed in to existing account.", "success");
        setTimeout(() => router.push("/dashboard"), 1000);
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
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing:border-box; margin:0; padding:0; }
        .auth-page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; background:#f3f4f6; }
        .auth-card { background:white; border-radius:16px; padding:40px; width:100%; max-width:440px; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
        .auth-logo { font-size:22px; font-weight:700; color:#111827; margin-bottom:8px; }
        .auth-subtitle { font-size:14px; color:#6b7280; margin-bottom:32px; }
        .step-indicator { display:flex; align-items:center; gap:8px; margin-bottom:28px; }
        .step-dot { width:8px; height:8px; border-radius:50%; transition:all .3s; }
        .step-dot.active { background:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.2); }
        .step-dot.done { background:#22c55e; }
        .step-dot.inactive { background:#e5e7eb; }
        .step-label { font-size:11px; color:#6b7280; letter-spacing:.5px; margin-left:4px; }
        .form-group { margin-bottom:16px; }
        .form-label { display:block; font-size:13px; font-weight:500; color:#374151; margin-bottom:6px; }
        .form-input { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:8px; font-size:14px; color:#111827; outline:none; transition:border-color .2s; }
        .form-input:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.1); }
        .form-input:disabled { background:#f9fafb; color:#9ca3af; }
        .form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .phone-row { display:flex; gap:8px; }
        .phone-prefix { padding:11px 12px; border:1.5px solid #e5e7eb; border-radius:8px; font-size:14px; color:#6b7280; background:#f9fafb; white-space:nowrap; flex-shrink:0; }
        .password-wrap { position:relative; }
        .password-toggle { position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#6b7280; font-size:13px; padding:4px; }
        .btn-primary { width:100%; padding:12px; background:#2563eb; color:white; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; transition:background .2s; }
        .btn-primary:hover:not(:disabled) { background:#1d4ed8; }
        .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
        .btn-secondary { width:100%; padding:12px; background:white; color:#374151; border:1.5px solid #e5e7eb; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; margin-top:10px; transition:all .2s; }
        .btn-secondary:hover { background:#f9fafb; }
        .btn-google { width:100%; padding:12px; background:white; color:#374151; border:1.5px solid #e5e7eb; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; transition:all .2s; display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:20px; }
        .btn-google:hover:not(:disabled) { background:#f9fafb; border-color:#d1d5db; }
        .btn-google:disabled { opacity:.5; cursor:not-allowed; }
        .divider { display:flex; align-items:center; gap:12px; margin-bottom:20px; }
        .divider-line { flex:1; height:1px; background:#e5e7eb; }
        .divider-text { font-size:12px; color:#9ca3af; font-weight:500; }
        .auth-link { color:#2563eb; text-decoration:none; font-weight:500; }
        .auth-link:hover { text-decoration:underline; }
        .auth-footer { text-align:center; font-size:13px; color:#6b7280; margin-top:24px; }
        .otp-wrap { animation:fadeIn .3s ease-out; }
        .otp-info { background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px 14px; font-size:13px; color:#1d4ed8; margin-bottom:20px; line-height:1.5; }
        .otp-input { width:100%; padding:16px; border:1.5px solid #d1d5db; border-radius:8px; font-size:24px; font-weight:600; text-align:center; letter-spacing:12px; outline:none; transition:border-color .2s; }
        .otp-input:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.1); }
        .back-btn { background:none; border:none; color:#6b7280; cursor:pointer; font-size:13px; text-decoration:underline; padding:0; margin-bottom:16px; display:block; }
        .spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,.3); border-top-color:white; border-radius:50%; animation:spin .7s linear infinite; vertical-align:middle; margin-right:8px; }
        .spinner-dark { border-color:rgba(55,65,81,.2); border-top-color:#374151; }
        .password-strength { font-size:12px; margin-top:4px; }
        .strength-weak { color:#ef4444; }
        .strength-ok { color:#f59e0b; }
        .strength-strong { color:#22c55e; }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      

      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">VGR Studio</div>
          <p className="auth-subtitle">Create your account</p>

          {/* Step indicators */}
          <div className="step-indicator">
            <div className={`step-dot ${step === "details" ? "active" : "done"}`} />
            <div style={{ width: 24, height: 1, background: step === "otp" ? "#22c55e" : "#e5e7eb" }} />
            <div className={`step-dot ${step === "otp" ? "active" : "inactive"}`} />
            <span className="step-label">{step === "details" ? "STEP 1 OF 2 — YOUR DETAILS" : "STEP 2 OF 2 — VERIFY PHONE"}</span>
          </div>

          {step === "details" && (
            <>
              {/* Google Signup */}
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

              {/* Details Form */}
              <form onSubmit={handleDetailsSubmit}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input className="form-input" type="text" placeholder="Sarah & James" value={fullName} onChange={e => setFullName(e.target.value)} disabled={isLoading} />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input className="form-input" type="text" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading} />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <div className="phone-row">
                    <select className="phone-prefix" value={countryCode} onChange={e => setCountryCode(e.target.value)}>{COUNTRY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                    <input className="form-input" type="tel" placeholder="555 000 0000" value={phone} onChange={e => setPhone(e.target.value)} disabled={isLoading} style={{ flex: 1 }} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div className="password-wrap">
                    <input className="form-input" type={showPassword ? "text" : "password"} placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading} style={{ paddingRight: 44 }} />
                    <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {password && (
                    <div className={`password-strength ${password.length < 6 ? "strength-weak" : password.length < 10 ? "strength-ok" : "strength-strong"}`}>
                      {password.length < 6 ? "Weak" : password.length < 10 ? "Moderate" : "Strong"} password
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <div className="password-wrap">
                    <input className="form-input" type={showConfirm ? "text" : "password"} placeholder="Repeat password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={isLoading} style={{ paddingRight: 44, borderColor: confirmPassword && confirmPassword !== password ? "#ef4444" : undefined }} />
                    <button type="button" className="password-toggle" onClick={() => setShowConfirm(!showConfirm)}>
                      {showConfirm ? "Hide" : "Show"}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <div className="password-strength strength-weak">Passwords do not match</div>
                  )}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div id="recaptcha-container" />
                </div>

                <button className="btn-primary" type="submit" disabled={isLoading || sendingOtp}>
                  {sendingOtp ? "Sending OTP..." : "Continue →"}
                </button>
              </form>
            </>
          )}

          {step === "otp" && (
            <div className="otp-wrap">
              <div className="otp-info">
                📱 A 6-digit code was sent to <strong>{fullPhoneE164()}</strong>.<br />
                <span style={{ color: "#1e40af", opacity: .8 }}>Enter the OTP sent by Firebase SMS after completing CAPTCHA verification.</span>
              </div>
              <button className="back-btn" onClick={() => setStep("details")}>← Change details</button>
              <form onSubmit={handleOtpSubmit}>
                <div className="form-group">
                  <label className="form-label">Enter 6-digit OTP</label>
                  <input
                    className="otp-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="• • • • • •"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    autoFocus
                  />
                </div>
                <button className="btn-primary" type="submit" disabled={loading || otp.length !== 6}>
                  {loading ? <><span className="spinner" />Creating account...</> : "Verify & Create Account"}
                </button>
                <button type="button" className="btn-secondary" disabled={isLoading || sendingOtp} onClick={async () => { setSendingOtp(true); try { await sendOtpFlow(); } catch (err) { showToast(getAuthError(err), "error"); } finally { setSendingOtp(false); } }}>
                  {sendingOtp ? "Resending..." : "Resend OTP"}
                </button>
              </form>
            </div>
          )}

          <div className="auth-footer">
            Already have an account?{" "}
            <a href="/login" className="auth-link">Sign in</a>
          </div>
        </div>
      </div>
    </>
  );
}
