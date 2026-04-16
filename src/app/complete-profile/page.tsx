"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

function isValidPhone(phone: string): boolean {
  return /^\+?[\d\s\-().]{7,20}$/.test(phone) && phone.replace(/\D/g, "").length >= 7;
}

type Step = "profile" | "otp";

export default function CompleteProfilePage() {
  const { user, firestoreUser, completeGoogleProfile, refreshFirestoreUser } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("profile");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Redirect if not logged in or already completed profile
  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    // If user already has phone and both providers, redirect to dashboard
    if (firestoreUser?.phone && firestoreUser?.provider === "both") {
      router.push("/dashboard");
    }
  }, [user, firestoreUser, router]);

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isValidPhone(phone)) { setError("Please enter a valid phone number."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setStep("otp");
    setSuccess("OTP sent to your phone. Use 123456 for now.");
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) { setError("Please enter the 6-digit OTP."); return; }
    // Placeholder OTP check
    if (otp !== "123456") { setError("Invalid OTP. Hint: use 123456"); return; }

    setLoading(true);
    try {
      await completeGoogleProfile(phone, password);
      await refreshFirestoreUser();
      setSuccess("Profile completed! Redirecting...");
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (msg.includes("credential-already-in-use")) {
        setError("This email/password is already linked to another account.");
      } else if (msg.includes("provider-already-linked")) {
        setError("Email/password is already linked to your account.");
      } else {
        setError(msg.replace("Firebase: ", "").replace(/\s*\(auth\/.*?\)\.?/, "").trim());
      }
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing:border-box; margin:0; padding:0; }
        .page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; background:#f3f4f6; }
        .card { background:white; border-radius:16px; padding:40px; width:100%; max-width:440px; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
        .logo { font-size:22px; font-weight:700; color:#111827; margin-bottom:8px; }
        .subtitle { font-size:14px; color:#6b7280; margin-bottom:8px; line-height:1.5; }
        .user-info { display:flex; align-items:center; gap:12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:14px; margin-bottom:28px; }
        .user-avatar { width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,#2563eb,#7c3aed); display:flex; align-items:center; justify-content:center; color:white; font-size:16px; font-weight:600; flex-shrink:0; }
        .user-name { font-size:14px; font-weight:500; color:#111827; }
        .user-email { font-size:12px; color:#6b7280; }
        .step-dots { display:flex; align-items:center; gap:8px; margin-bottom:28px; }
        .dot { width:8px; height:8px; border-radius:50%; }
        .dot-active { background:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.2); }
        .dot-done { background:#22c55e; }
        .dot-inactive { background:#e5e7eb; }
        .step-text { font-size:11px; color:#6b7280; letter-spacing:.5px; margin-left:4px; }
        .form-group { margin-bottom:16px; }
        .form-label { display:block; font-size:13px; font-weight:500; color:#374151; margin-bottom:6px; }
        .form-input { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:8px; font-size:14px; color:#111827; outline:none; transition:border-color .2s; }
        .form-input:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.1); }
        .phone-row { display:flex; gap:8px; }
        .phone-prefix { padding:11px 12px; border:1.5px solid #e5e7eb; border-radius:8px; font-size:14px; color:#6b7280; background:#f9fafb; white-space:nowrap; flex-shrink:0; }
        .pw-wrap { position:relative; }
        .pw-toggle { position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#6b7280; font-size:13px; }
        .btn-primary { width:100%; padding:12px; background:#2563eb; color:white; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; transition:background .2s; }
        .btn-primary:hover:not(:disabled) { background:#1d4ed8; }
        .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
        .error-box { background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px; color:#dc2626; font-size:13px; margin-bottom:16px; }
        .success-box { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px; color:#15803d; font-size:13px; margin-bottom:16px; }
        .otp-info { background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px 14px; font-size:13px; color:#1d4ed8; margin-bottom:20px; line-height:1.5; }
        .otp-input { width:100%; padding:16px; border:1.5px solid #d1d5db; border-radius:8px; font-size:24px; font-weight:600; text-align:center; letter-spacing:12px; outline:none; transition:border-color .2s; }
        .otp-input:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.1); }
        .back-btn { background:none; border:none; color:#6b7280; cursor:pointer; font-size:13px; text-decoration:underline; padding:0; margin-bottom:16px; display:block; }
        .spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,.3); border-top-color:white; border-radius:50%; animation:spin .7s linear infinite; vertical-align:middle; margin-right:8px; }
        .pw-strength { font-size:12px; margin-top:4px; }
        .pw-weak { color:#ef4444; }
        .pw-ok { color:#f59e0b; }
        .pw-strong { color:#22c55e; }
      `}</style>

      <div className="page">
        <div className="card">
          <div className="logo">VGR Studio</div>
          <p className="subtitle">Complete your profile to secure your account</p>

          {/* User info banner */}
          <div className="user-info">
            <div className="user-avatar">
              {(user.displayName || user.email || "?")[0].toUpperCase()}
            </div>
            <div>
              <div className="user-name">{user.displayName || "Google User"}</div>
              <div className="user-email">{user.email}</div>
            </div>
          </div>

          {/* Step dots */}
          <div className="step-dots">
            <div className={`dot ${step === "profile" ? "dot-active" : "dot-done"}`} />
            <div style={{ width: 24, height: 1, background: step === "otp" ? "#22c55e" : "#e5e7eb" }} />
            <div className={`dot ${step === "otp" ? "dot-active" : "dot-inactive"}`} />
            <span className="step-text">
              {step === "profile" ? "SET PHONE & PASSWORD" : "VERIFY PHONE"}
            </span>
          </div>

          {error && <div className="error-box">⚠ {error}</div>}
          {success && <div className="success-box">✓ {success}</div>}

          {step === "profile" && (
            <form onSubmit={handleProfileSubmit}>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <div className="phone-row">
                  <div className="phone-prefix">+1</div>
                  <input className="form-input" type="tel" placeholder="555 000 0000" value={phone} onChange={e => setPhone(e.target.value)} style={{ flex: 1 }} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Create Password</label>
                <div className="pw-wrap">
                  <input className="form-input" type={showPassword ? "text" : "password"} placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} style={{ paddingRight: 44 }} />
                  <button type="button" className="pw-toggle" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {password && (
                  <div className={`pw-strength ${password.length < 6 ? "pw-weak" : password.length < 10 ? "pw-ok" : "pw-strong"}`}>
                    {password.length < 6 ? "Weak" : password.length < 10 ? "Moderate" : "Strong"} password
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={{ borderColor: confirmPassword && confirmPassword !== password ? "#ef4444" : undefined }}
                />
                {confirmPassword && confirmPassword !== password && (
                  <div className="pw-strength pw-weak">Passwords do not match</div>
                )}
              </div>

              <button className="btn-primary" type="submit">Send OTP & Continue →</button>
            </form>
          )}

          {step === "otp" && (
            <div style={{ animation: "fadeIn .3s ease-out" }}>
              <div className="otp-info">
                📱 OTP sent to <strong>{phone}</strong>.<br />
                <span style={{ opacity: .8 }}>SMS integration coming soon — use <strong>123456</strong> for now.</span>
              </div>
              <button className="back-btn" onClick={() => { setStep("profile"); setOtp(""); setError(""); }}>← Change details</button>
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
                  {loading ? <><span className="spinner" />Linking account...</> : "Verify & Complete"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
