"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,300;0,400;1,300;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#F9F8F6;color:#111827;min-height:100vh;overflow-x:hidden;}
.auth-wrap{min-height:100vh;display:grid;grid-template-columns:1fr 1fr;}
@media(max-width:900px){.auth-wrap{grid-template-columns:1fr;} .auth-left{display:none;}}

/* Left decorative panel */
.auth-left{
  background:linear-gradient(160deg,#1B4F8C 0%,#12204A 50%,#6B1535 100%);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:3rem;position:relative;overflow:hidden;
}
.auth-left::before{
  content:'';position:absolute;inset:0;
  background:radial-gradient(ellipse 70% 60% at 30% 30%,rgba(130,184,232,0.2),transparent),
             radial-gradient(ellipse 60% 70% at 70% 70%,rgba(242,184,207,0.15),transparent);
}
.auth-orb{
  position:absolute;border-radius:50%;filter:blur(60px);
  animation:orbFloat 6s ease-in-out infinite alternate;
}
@keyframes orbFloat{from{transform:translateY(0) scale(1);}to{transform:translateY(-20px) scale(1.08);}}
.left-content{position:relative;z-index:2;text-align:center;}
.left-logo{font-family:'Playfair Display',serif;font-size:2rem;font-weight:300;color:white;margin-bottom:0.4rem;}
.left-tag{font-size:0.65rem;letter-spacing:0.3em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:3rem;}
.left-quote{font-family:'Playfair Display',serif;font-size:1.5rem;font-style:italic;font-weight:300;color:rgba(255,255,255,0.85);line-height:1.5;margin-bottom:1.5rem;max-width:320px;}
.left-sub{font-size:0.82rem;color:rgba(255,255,255,0.4);line-height:1.7;max-width:280px;}
.journey-preview{margin-top:3rem;display:flex;flex-direction:column;gap:1rem;width:100%;max-width:280px;}
.jp-step{display:flex;align-items:center;gap:0.8rem;padding:0.8rem 1rem;border-radius:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);}
.jp-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.jp-dot-done{background:#82B8E8;}
.jp-dot-pending{background:rgba(255,255,255,0.2);}
.jp-label{font-size:0.78rem;color:rgba(255,255,255,0.6);}

/* Right form panel */
.auth-right{display:flex;align-items:center;justify-content:center;padding:3rem 2rem;background:#FAFAF9;}
.auth-card{width:100%;max-width:440px;}
.auth-header{margin-bottom:2.4rem;}
.auth-title{font-family:'Playfair Display',serif;font-size:2rem;font-weight:300;margin-bottom:0.4rem;}
.auth-subtitle{font-size:0.88rem;color:#6B7280;font-weight:300;}
.tab-row{display:flex;margin-bottom:2rem;border-bottom:1px solid rgba(0,0,0,0.08);}
.tab-btn{flex:1;padding:0.75rem;border:none;background:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;font-size:0.82rem;font-weight:500;letter-spacing:0.06em;color:#6B7280;border-bottom:2px solid transparent;margin-bottom:-1px;transition:color 0.2s,border-color 0.2s;}
.tab-btn.active{color:#1B4F8C;border-bottom-color:#1B4F8C;}
.form-group{margin-bottom:1.2rem;}
.form-label{display:block;font-size:0.75rem;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#374151;margin-bottom:0.45rem;}
.form-input{
  width:100%;padding:0.85rem 1rem;border-radius:4px;
  border:1px solid rgba(0,0,0,0.12);background:white;
  font-family:'Plus Jakarta Sans',sans-serif;font-size:0.92rem;color:#111827;
  transition:border-color 0.2s,box-shadow 0.2s;outline:none;
}
.form-input:focus{border-color:#2E7DD1;box-shadow:0 0 0 3px rgba(46,125,209,0.1);}
.form-input::placeholder{color:#9CA3AF;}
.btn-submit{
  width:100%;padding:1rem;border:none;border-radius:4px;cursor:pointer;
  background:linear-gradient(135deg,#2E7DD1,#C2527A);color:white;
  font-family:'Plus Jakarta Sans',sans-serif;font-size:0.84rem;font-weight:500;
  letter-spacing:0.1em;text-transform:uppercase;
  box-shadow:0 4px 16px rgba(46,125,209,0.25);
  transition:transform 0.2s,box-shadow 0.2s,opacity 0.2s;
  margin-top:0.5rem;
}
.btn-submit:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(46,125,209,0.32);}
.btn-submit:disabled{opacity:0.6;cursor:not-allowed;transform:none;}
.divider{display:flex;align-items:center;gap:1rem;margin:1.4rem 0;color:#9CA3AF;font-size:0.78rem;}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:rgba(0,0,0,0.08);}
.btn-google{
  width:100%;padding:0.9rem;border-radius:4px;border:1px solid rgba(0,0,0,0.12);
  background:white;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;
  font-size:0.84rem;font-weight:500;color:#374151;
  display:flex;align-items:center;justify-content:center;gap:0.7rem;
  transition:background 0.2s,border-color 0.2s,transform 0.2s;
}
.btn-google:hover{background:#F9FAFB;border-color:#2E7DD1;transform:translateY(-1px);}
.google-icon{width:18px;height:18px;}
.error-msg{font-size:0.8rem;color:#DC2626;margin-top:0.4rem;padding:0.6rem 0.8rem;background:#FEF2F2;border-radius:4px;border:1px solid rgba(220,38,38,0.15);}
.success-msg{font-size:0.8rem;color:#16A34A;margin-top:0.4rem;padding:0.6rem 0.8rem;background:#F0FDF4;border-radius:4px;border:1px solid rgba(22,163,74,0.15);}
.forgot-link{font-size:0.78rem;color:#2E7DD1;cursor:pointer;text-decoration:none;display:block;text-align:right;margin-top:0.3rem;}
.forgot-link:hover{text-decoration:underline;}
.verify-banner{padding:1rem;background:#EFF6FF;border:1px solid rgba(46,125,209,0.2);border-radius:6px;margin-bottom:1.4rem;font-size:0.83rem;color:#1B4F8C;line-height:1.6;}
`;

export default function AuthPage() {
  const router = useRouter();
  const [redirectPath, setRedirectPath] = useState("/dashboard");
  const [loginMessage, setLoginMessage] = useState("");
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showReset, setShowReset] = useState(false);

  const { user, loading: authLoading, loginWithEmail, registerWithEmail, loginWithGoogle, resetPassword, logout } = useAuth();
  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  const isValidPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    const message = params.get("message");
    if (redirect) setRedirectPath(redirect);
    if (message) setLoginMessage(message);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      if (!isValidEmail(email.trim().toLowerCase())) {
        throw new Error("Please enter a valid email address.");
      }

      if (tab === "login") {
        await loginWithEmail(email.trim().toLowerCase(), password);
        router.push(redirectPath);
      } else {
        if (!isValidPhone(mobile)) {
          throw new Error("Please enter a valid mobile number.");
        }
        await registerWithEmail(email.trim().toLowerCase(), password);
        setSuccess("Account created! Please verify your email before logging in.");
        setTab("login");
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "Something went wrong";
      setError(friendlyError(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(""); setLoading(true);
    try {
      await loginWithGoogle();
      router.push(redirectPath);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) { setError("Please enter your email address first."); return; }
    if (!isValidEmail(email.trim().toLowerCase())) { setError("Please enter a valid email address first."); return; }
    setError(""); setLoading(true);
    try {
      await resetPassword(email.trim().toLowerCase());
      setSuccess("Password reset email sent! Check your inbox.");
      setShowReset(false);
    } catch {
      setError("Failed to send reset email. Check the address and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="auth-wrap">
        {/* Left decorative panel */}
        <div className="auth-left">
          <div className="auth-orb" style={{ width: 300, height: 300, top: "10%", left: "-10%", background: "rgba(46,125,209,0.25)" }} />
          <div className="auth-orb" style={{ width: 250, height: 250, bottom: "5%", right: "-8%", background: "rgba(194,82,122,0.2)", animationDelay: "2s" }} />
          <div className="left-content">
            <div className="left-logo">Virtual Gender Reveal</div>
            <div className="left-tag">Crafted for Moments That Matter</div>
            <div className="left-quote">"The moment everyone finds out, all at once, together."</div>
            <div className="left-sub">A cinematic reveal experience built for families spread across the world.</div>
            <div className="journey-preview">
              {["Payment Complete", "Doctor Notified", "Video Ready", "Go Live"].map((s, i) => (
                <div className="jp-step" key={i}>
                  <div className={`jp-dot ${i === 0 ? "jp-dot-done" : "jp-dot-pending"}`} />
                  <div className="jp-label">{s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="auth-right">
          <div className="auth-card">
            <div className="auth-header">
              <div className="auth-title">{tab === "login" ? "Welcome back" : "Create account"}</div>
              <div className="auth-subtitle">
                {tab === "login" ? "Sign in to manage your reveal" : "Start planning your reveal today"}
              </div>
            </div>

            {!authLoading && user && (
              <div className="verify-banner">
                You are logged in as <strong>{user.displayName || user.email}</strong>.{" "}
                <a href="/dashboard" style={{ color: "#1B4F8C", fontWeight: 600 }}>Go to dashboard</a>
                {" "}or{" "}
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    setSuccess("You have been logged out.");
                  }}
                  style={{ border: "none", background: "none", color: "#1B4F8C", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                >
                  switch account
                </button>.
              </div>
            )}

            <div className="tab-row">
              <button className={`tab-btn${tab === "login" ? " active" : ""}`} onClick={() => { setTab("login"); setError(""); setSuccess(""); }}>Log In</button>
              <button className={`tab-btn${tab === "register" ? " active" : ""}`} onClick={() => { setTab("register"); setError(""); setSuccess(""); }}>Register</button>
            </div>

            {loginMessage === "login_required" && (
              <div className="verify-banner">Please login to continue.</div>
            )}
            {success && <div className="verify-banner">✓ {success}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
                {tab === "login" && (
                  <span className="forgot-link" onClick={() => setShowReset(true)}>Forgot password?</span>
                )}
              </div>
              {tab === "register" && (
                <div className="form-group">
                  <label className="form-label">Mobile Number (OTP placeholder)</label>
                  <input
                    className="form-input"
                    type="tel"
                    placeholder="+1 555 123 4567"
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    required={tab === "register"}
                  />
                  <button
                    type="button"
                    className="btn-submit"
                    style={{ marginTop: "0.6rem", background: "rgba(46,125,209,0.1)", color: "#1B4F8C", boxShadow: "none" }}
                    onClick={() => {
                      if (!mobile.trim()) { setError("Please enter a mobile number first."); return; }
                      setError("");
                      setOtpSent(true);
                    }}
                  >
                    Send OTP (Placeholder)
                  </button>
                  {otpSent && <div className="success-msg">OTP placeholder sent. For now, any number is accepted.</div>}
                </div>
              )}
              {showReset && (
                <div style={{ marginBottom: "1rem" }}>
                  <button type="button" className="btn-submit" style={{ background: "rgba(46,125,209,0.1)", color: "#1B4F8C", boxShadow: "none" }} onClick={handleReset} disabled={loading}>
                    Send Reset Email
                  </button>
                </div>
              )}
              {error && <div className="error-msg">⚠ {error}</div>}
              <button className="btn-submit" type="submit" disabled={loading}>
                {loading ? "Please wait…" : tab === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <div className="divider">or continue with</div>

            <button className="btn-google" onClick={handleGoogle} disabled={loading}>
              <svg className="google-icon" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function friendlyError(msg: string): string {
  if (msg.includes("user-not-found") || msg.includes("wrong-password") || msg.includes("invalid-credential")) return "Invalid email or password.";
  if (msg.includes("email-already-in-use")) return "An account with this email already exists.";
  if (msg.includes("weak-password")) return "Password must be at least 8 characters.";
  if (msg.includes("too-many-requests")) return "Too many attempts. Please wait a moment and try again.";
  return msg;
}
