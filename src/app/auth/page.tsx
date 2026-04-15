"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { Suspense } from "react";

type ToastType = "success" | "error" | "info";

function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  const colors: Record<ToastType, string> = { success: "#22c55e", error: "#ef4444", info: "#c8a4c4" };
  const icons: Record<ToastType, string> = { success: "✓", error: "✕", info: "✦" };
  return (
    <div style={{
      position:"fixed",top:24,right:24,zIndex:9999,display:"flex",alignItems:"flex-start",gap:12,
      background:"#1a1018",border:`1px solid ${colors[type]}40`,borderLeft:`3px solid ${colors[type]}`,
      borderRadius:10,padding:"14px 18px",maxWidth:380,boxShadow:"0 8px 30px rgba(0,0,0,0.5)",
      animation:"slideIn 0.3s ease-out",fontFamily:"'Jost',sans-serif",
    }}>
      <span style={{color:colors[type],fontSize:16,fontWeight:700,marginTop:1,flexShrink:0}}>{icons[type]}</span>
      <span style={{color:"#f5eff5",fontSize:13,fontWeight:300,lineHeight:1.5,flex:1}}>{message}</span>
      <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(245,239,245,0.3)",cursor:"pointer",fontSize:18,padding:0,marginLeft:8,lineHeight:1}}>×</button>
    </div>
  );
}

// Proper email regex — rejects xyz@abc, xyz.com, @abc.com
function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email.trim());
}

// Phone validation — must be 7-15 digits, optional + prefix
function isValidPhone(phone: string): boolean {
  return /^\+?[\d\s\-().]{7,20}$/.test(phone.trim()) && phone.replace(/\D/g, "").length >= 7;
}

function AuthContent() {
  const params = useSearchParams();
  const initialMode = params.get("mode") === "signup" ? "signup" : "signin";
  const intendedPlan = params.get("plan") || "";

  const [mode, setMode] = useState<"signin"|"signup">(initialMode);
  // Signup steps: 1=details, 2=otp
  const [signupStep, setSignupStep] = useState<1|2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message:string;type:ToastType}|null>(null);
  const { loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth();
  const router = useRouter();

  function showToast(message: string, type: ToastType) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }

  function getFirebaseError(err: unknown): string {
    const msg = err instanceof Error ? err.message : "Something went wrong";
    if (msg.includes("user-not-found") || msg.includes("invalid-credential") || msg.includes("INVALID_LOGIN_CREDENTIALS"))
      return "No account found with this email and password. Please check your details or create a new account.";
    if (msg.includes("wrong-password")) return "Incorrect password. Please try again.";
    if (msg.includes("email-already-in-use")) return "An account with this email already exists. Please sign in instead.";
    if (msg.includes("weak-password")) return "Password must be at least 6 characters long.";
    if (msg.includes("invalid-email")) return "Please enter a valid email address.";
    if (msg.includes("too-many-requests")) return "Too many attempts. Please wait a moment and try again.";
    if (msg.includes("network-request-failed")) return "Network error. Please check your connection.";
    if (msg.includes("popup-closed-by-user")) return "Sign-in was cancelled. Please try again.";
    return msg.replace("Firebase: ","").replace(/\s*\(auth\/.*?\)\.?/,"").trim();
  }

  function redirectAfterAuth() {
    // Intent preservation — if plan was stored, go back to landing pricing
    const savedPlan = intendedPlan || sessionStorage.getItem("vgr_intended_plan") || "";
    if (savedPlan) {
      sessionStorage.removeItem("vgr_intended_plan");
      sessionStorage.setItem("vgr_resume_plan", savedPlan);
      router.push("/");
    } else {
      router.push("/dashboard");
    }
  }

  // Step 1 → Step 2: validate then "send OTP"
  async function handleSignupStep1(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) { showToast("Please enter your full name.", "error"); return; }
    if (!isValidEmail(email)) { showToast("Please enter a valid email address (e.g. name@example.com).", "error"); return; }
    if (!isValidPhone(phone)) { showToast("Please enter a valid phone number with country code (e.g. +1 555 000 0000).", "error"); return; }
    if (password.length < 6) { showToast("Password must be at least 6 characters.", "error"); return; }

    setLoading(true);
    // Simulate sending OTP (placeholder — replace with real SMS service later)
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    setSignupStep(2);
    showToast(`A verification code has been sent to ${phone}. Use 123456 for now (SMS service coming soon).`, "info");
  }

  // Step 2: verify OTP then create account
  async function handleSignupStep2(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) { showToast("Please enter the 6-digit code.", "error"); return; }
    // Placeholder OTP check — replace with real verification later
    if (otp !== "123456") { showToast("Incorrect code. Please try again. (Hint: use 123456)", "error"); return; }

    setLoading(true);
    try {
      await registerWithEmail(email, password);
      const firstName = displayName.trim().split(" ")[0];
      showToast(`🎉 Welcome, ${firstName}! Your account has been created successfully.`, "success");
      setTimeout(() => redirectAfterAuth(), 2000);
    } catch (err) {
      showToast(getFirebaseError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) { showToast("Please enter a valid email address (e.g. name@example.com).", "error"); return; }
    if (!password) { showToast("Please enter your password.", "error"); return; }

    setLoading(true);
    try {
      await loginWithEmail(email, password);
      showToast("Welcome back! Taking you to your dashboard...", "success");
      setTimeout(() => redirectAfterAuth(), 1500);
    } catch (err) {
      showToast(getFirebaseError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      await loginWithGoogle();
      showToast("Signed in with Google!", "success");
      setTimeout(() => redirectAfterAuth(), 1500);
    } catch (err) {
      showToast(getFirebaseError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m: "signin"|"signup") {
    setMode(m);
    setSignupStep(1);
    setEmail(""); setPassword(""); setDisplayName(""); setPhone(""); setOtp(""); setToast(null);
  }

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
    @keyframes float{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(20px,-30px) scale(1.05)}66%{transform:translate(-15px,20px) scale(0.95)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    .auth-root{min-height:100vh;display:flex;font-family:'Jost',sans-serif;background:#0a0608;position:relative;overflow:hidden}
    .blob{position:fixed;border-radius:50%;filter:blur(80px);opacity:.18;pointer-events:none;animation:float 12s ease-in-out infinite}
    .blob-1{width:500px;height:500px;background:#c8a4c4;top:-100px;left:-150px}
    .blob-2{width:400px;height:400px;background:#a4b4c8;top:40%;right:-100px;animation-delay:-4s}
    .blob-3{width:300px;height:300px;background:#c8b4a4;bottom:-50px;left:30%;animation-delay:-8s}
    .back-link{position:fixed;top:24px;left:24px;z-index:100;display:flex;align-items:center;gap:8px;font-family:'Jost',sans-serif;font-size:11px;font-weight:300;letter-spacing:1.5px;text-transform:uppercase;color:rgba(245,239,245,0.35);text-decoration:none;transition:all 0.2s;padding:8px 14px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:rgba(255,255,255,0.03);backdrop-filter:blur(10px)}
    .back-link:hover{color:rgba(245,239,245,0.7);border-color:rgba(255,255,255,0.15)}
    .brand-panel{display:none;flex:1;background:linear-gradient(145deg,#1a0f18 0%,#0f1520 50%,#1a120f 100%);position:relative;overflow:hidden;padding:60px;flex-direction:column;justify-content:space-between}
    @media(min-width:960px){.brand-panel{display:flex}}
    .brand-pattern{position:absolute;inset:0;background-image:radial-gradient(circle at 20% 30%,rgba(200,164,196,.08) 0%,transparent 50%),radial-gradient(circle at 80% 70%,rgba(164,180,200,.08) 0%,transparent 50%)}
    .brand-ornament{width:60px;height:1px;background:linear-gradient(90deg,transparent,rgba(200,164,196,.6),transparent);margin:20px 0}
    .brand-title{font-family:'Cormorant Garamond',serif;font-size:52px;font-weight:300;line-height:1.15;color:#f5eff5;letter-spacing:-.5px}
    .brand-title em{font-style:italic;color:#c8a4c4}
    .brand-tagline{font-size:13px;font-weight:300;letter-spacing:3px;text-transform:uppercase;color:rgba(245,239,245,.4);margin-top:24px}
    .brand-features{display:flex;flex-direction:column;gap:28px}
    .brand-feature{display:flex;align-items:flex-start;gap:16px}
    .feature-dot{width:6px;height:6px;border-radius:50%;background:#c8a4c4;margin-top:7px;flex-shrink:0;box-shadow:0 0 10px rgba(200,164,196,.5)}
    .feature-text h4{font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:400;color:rgba(245,239,245,.9);margin-bottom:4px}
    .feature-text p{font-size:12px;font-weight:300;color:rgba(245,239,245,.35);line-height:1.6}
    .brand-footer{font-size:11px;font-weight:300;color:rgba(245,239,245,.2);letter-spacing:1px}
    .form-panel{flex:none;width:100%;display:flex;align-items:center;justify-content:center;padding:80px 24px 40px;position:relative;z-index:1}
    @media(min-width:960px){.form-panel{width:480px;padding:40px 24px}}
    .form-card{width:100%;max-width:400px}
    .form-logo{font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:300;letter-spacing:4px;text-transform:uppercase;color:rgba(200,164,196,.7);margin-bottom:40px;display:flex;align-items:center;gap:10px}
    .form-logo::before{content:'';display:block;width:20px;height:1px;background:rgba(200,164,196,.4)}
    .form-heading{font-family:'Cormorant Garamond',serif;font-size:36px;font-weight:300;color:#f5eff5;line-height:1.2;margin-bottom:8px}
    .form-heading em{font-style:italic;color:#c8a4c4}
    .form-subheading{font-size:13px;font-weight:300;color:rgba(245,239,245,.35);margin-bottom:32px;line-height:1.6}
    .mode-toggle{display:flex;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:3px;margin-bottom:24px;gap:3px}
    .mode-btn{flex:1;padding:10px;border:none;border-radius:6px;font-family:'Jost',sans-serif;font-size:12px;font-weight:400;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .2s;background:transparent;color:rgba(245,239,245,.35)}
    .mode-btn.active{background:rgba(200,164,196,.15);color:#c8a4c4;border:1px solid rgba(200,164,196,.2)}
    .google-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:12px;padding:13px 20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:rgba(245,239,245,.8);font-family:'Jost',sans-serif;font-size:13px;font-weight:400;cursor:pointer;transition:all .2s;margin-bottom:20px}
    .google-btn:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.18);color:#f5eff5}
    .google-btn:disabled{opacity:.4;cursor:not-allowed}
    .divider{display:flex;align-items:center;gap:16px;margin-bottom:20px}
    .divider-line{flex:1;height:1px;background:rgba(255,255,255,.07)}
    .divider-text{font-size:11px;font-weight:300;letter-spacing:2px;text-transform:uppercase;color:rgba(245,239,245,.2)}
    .fields{display:flex;flex-direction:column;gap:12px;margin-bottom:20px}
    .field label{display:block;font-size:10px;font-weight:400;letter-spacing:2px;text-transform:uppercase;color:rgba(245,239,245,.35);margin-bottom:7px}
    .field input{width:100%;padding:12px 16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#f5eff5;font-family:'Jost',sans-serif;font-size:14px;font-weight:300;outline:none;transition:all .2s}
    .field input::placeholder{color:rgba(245,239,245,.18)}
    .field input:focus{border-color:rgba(200,164,196,.35);background:rgba(200,164,196,.04);box-shadow:0 0 0 3px rgba(200,164,196,.06)}
    .field input.error{border-color:rgba(239,68,68,.4)}
    .phone-row{display:flex;gap:8px}
    .phone-prefix{padding:12px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:rgba(245,239,245,.4);font-family:'Jost',sans-serif;font-size:13px;white-space:nowrap;display:flex;align-items:center;flex-shrink:0}
    .optional{font-size:9px;letter-spacing:1px;color:rgba(245,239,245,.2);margin-left:6px;text-transform:uppercase}
    .otp-wrap{animation:fadeIn .3s ease-out}
    .otp-info{font-size:12px;font-weight:300;color:rgba(245,239,245,.4);line-height:1.6;margin-bottom:16px;padding:12px 16px;background:rgba(200,164,196,.06);border:1px solid rgba(200,164,196,.15);border-radius:8px}
    .otp-input{width:100%;padding:16px;background:rgba(255,255,255,.04);border:1px solid rgba(200,164,196,.25);border-radius:10px;color:#f5eff5;font-family:'Jost',sans-serif;font-size:22px;font-weight:400;outline:none;text-align:center;letter-spacing:8px;transition:all .2s}
    .otp-input:focus{border-color:rgba(200,164,196,.5);background:rgba(200,164,196,.06);box-shadow:0 0 0 3px rgba(200,164,196,.08)}
    .back-step{background:none;border:none;color:rgba(200,164,196,.6);font-family:'Jost',sans-serif;font-size:11px;font-weight:300;letter-spacing:1px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:0;margin-bottom:16px;display:block}
    .submit-btn{width:100%;padding:15px 20px;background:linear-gradient(135deg,rgba(200,164,196,.9),rgba(164,140,180,.9));border:none;border-radius:10px;color:#0a0608;font-family:'Jost',sans-serif;font-size:12px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;cursor:pointer;transition:all .25s;margin-bottom:18px}
    .submit-btn:hover{background:linear-gradient(135deg,rgba(218,185,215,.95),rgba(185,160,200,.95));transform:translateY(-1px);box-shadow:0 8px 25px rgba(200,164,196,.25)}
    .submit-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
    .switch-mode{text-align:center;font-size:12px;font-weight:300;color:rgba(245,239,245,.3)}
    .switch-mode button{background:none;border:none;color:#c8a4c4;cursor:pointer;font-family:'Jost',sans-serif;font-size:12px;font-weight:400;text-decoration:underline;text-underline-offset:3px;padding:0;margin-left:4px}
    .spinner{display:inline-block;width:13px;height:13px;border:2px solid rgba(10,6,8,.3);border-top-color:#0a0608;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:8px}
    .step-indicator{display:flex;align-items:center;gap:8px;margin-bottom:24px}
    .step-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.1);transition:all .3s}
    .step-dot.active{background:#c8a4c4;box-shadow:0 0 8px rgba(200,164,196,.5)}
    .step-dot.done{background:rgba(34,197,94,.5)}
  `;

  return (
    <>
      <style>{CSS}</style>
      {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)} />}

      <a href="/" className="back-link">← Back to website</a>

      <div className="auth-root">
        <div className="blob blob-1"/><div className="blob blob-2"/><div className="blob blob-3"/>

        {/* Brand Panel */}
        <div className="brand-panel">
          <div className="brand-pattern"/>
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:11,letterSpacing:4,textTransform:"uppercase",color:"rgba(200,164,196,0.5)",marginBottom:32}}>Virtual Gender Reveal</div>
            <h1 className="brand-title">The most <em>magical</em><br />reveal of your<br />life, online.</h1>
            <div className="brand-ornament"/>
            <p className="brand-tagline">Where moments become memories</p>
          </div>
          <div className="brand-features">
            {[
              {title:"Encrypted Gender Vault",desc:"Your doctor submits the gender through a secure, one-time link. Only revealed at your chosen moment."},
              {title:"Live Cinematic Reveal",desc:"Friends and family watch together — anywhere in the world — as the reveal unfolds in real time."},
              {title:"Phone Verified Accounts",desc:"Every account is verified with a mobile OTP for maximum security and peace of mind."},
            ].map(f=>(
              <div className="brand-feature" key={f.title}>
                <div className="feature-dot"/>
                <div className="feature-text"><h4>{f.title}</h4><p>{f.desc}</p></div>
              </div>
            ))}
          </div>
          <div className="brand-footer">© 2025 Virtual Gender Reveal · Privacy · Terms</div>
        </div>

        {/* Form Panel */}
        <div className="form-panel">
          <div className="form-card">
            <div className="form-logo">VGR Studio</div>

            {/* Mode toggle — only show on step 1 */}
            {(mode === "signin" || signupStep === 1) && (
              <div className="mode-toggle">
                <button className={`mode-btn${mode==="signin"?" active":""}`} onClick={()=>switchMode("signin")}>Sign In</button>
                <button className={`mode-btn${mode==="signup"?" active":""}`} onClick={()=>switchMode("signup")}>Create Account</button>
              </div>
            )}

            {/* ── SIGN IN ── */}
            {mode === "signin" && (
              <>
                <h2 className="form-heading">Welcome<br /><em>back.</em></h2>
                <p className="form-subheading">Sign in to manage your reveal and check your baby&apos;s secret.</p>
                <button className="google-btn" onClick={handleGoogle} disabled={loading}>
                  <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Continue with Google
                </button>
                <div className="divider"><div className="divider-line"/><span className="divider-text">or</span><div className="divider-line"/></div>
                <form onSubmit={handleSignin}>
                  <div className="fields">
                    <div className="field">
                      <label>Email Address</label>
                      <input type="text" placeholder="name@example.com" value={email} onChange={e=>setEmail(e.target.value)} required/>
                    </div>
                    <div className="field">
                      <label>Password</label>
                      <input type="password" placeholder="Your password" value={password} onChange={e=>setPassword(e.target.value)} required/>
                    </div>
                  </div>
                  <button className="submit-btn" type="submit" disabled={loading}>
                    {loading&&<span className="spinner"/>}{loading?"Signing in...":"Sign In"}
                  </button>
                </form>
                <div className="switch-mode">Don&apos;t have an account?<button onClick={()=>switchMode("signup")}>Sign up free</button></div>
              </>
            )}

            {/* ── SIGN UP STEP 1 — Details ── */}
            {mode === "signup" && signupStep === 1 && (
              <>
                <h2 className="form-heading">Begin your<br /><em>journey.</em></h2>
                <p className="form-subheading">Create your account. We&apos;ll verify your phone with a one-time code.</p>
                <div className="step-indicator">
                  <div className="step-dot active"/><div style={{width:24,height:1,background:"rgba(255,255,255,.1)"}}/><div className="step-dot"/><div style={{fontSize:10,color:"rgba(245,239,245,.25)",letterSpacing:1,marginLeft:4}}>STEP 1 OF 2</div>
                </div>
                <button className="google-btn" onClick={handleGoogle} disabled={loading}>
                  <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Continue with Google
                </button>
                <div className="divider"><div className="divider-line"/><span className="divider-text">or</span><div className="divider-line"/></div>
                <form onSubmit={handleSignupStep1}>
                  <div className="fields">
                    <div className="field">
                      <label>Full Name</label>
                      <input type="text" placeholder="e.g. Sarah & James" value={displayName} onChange={e=>setDisplayName(e.target.value)} required/>
                    </div>
                    <div className="field">
                      <label>Email Address</label>
                      <input type="text" placeholder="name@example.com" value={email} onChange={e=>setEmail(e.target.value)} required/>
                    </div>
                    <div className="field">
                      <label>Phone Number — for OTP verification</label>
                      <div className="phone-row">
                        <div className="phone-prefix">+1</div>
                        <input style={{flex:1,padding:"12px 16px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,color:"#f5eff5",fontFamily:"'Jost',sans-serif",fontSize:14,fontWeight:300,outline:"none",transition:"all .2s"}} type="tel" placeholder="555 000 0000" value={phone} onChange={e=>setPhone(e.target.value)} required/>
                      </div>
                    </div>
                    <div className="field">
                      <label>Password</label>
                      <input type="password" placeholder="Min. 6 characters" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/>
                    </div>
                  </div>
                  <button className="submit-btn" type="submit" disabled={loading}>
                    {loading&&<span className="spinner"/>}{loading?"Sending code...":"Continue →"}
                  </button>
                </form>
                <div className="switch-mode">Already have an account?<button onClick={()=>switchMode("signin")}>Sign in</button></div>
              </>
            )}

            {/* ── SIGN UP STEP 2 — OTP ── */}
            {mode === "signup" && signupStep === 2 && (
              <div className="otp-wrap">
                <h2 className="form-heading">Verify your<br /><em>phone.</em></h2>
                <p className="form-subheading">Enter the 6-digit code sent to your phone number.</p>
                <div className="step-indicator">
                  <div className="step-dot done"/><div style={{width:24,height:1,background:"rgba(34,197,94,.3)"}}/><div className="step-dot active"/><div style={{fontSize:10,color:"rgba(245,239,245,.25)",letterSpacing:1,marginLeft:4}}>STEP 2 OF 2</div>
                </div>
                <div className="otp-info">
                  📱 A verification code has been sent to <strong style={{color:"rgba(245,239,245,.7)"}}>{phone}</strong>.<br/>
                  <span style={{color:"rgba(200,164,196,.7)"}}>SMS service coming soon — use <strong>123456</strong> for now.</span>
                </div>
                <button className="back-step" onClick={()=>setSignupStep(1)}>← Change details</button>
                <form onSubmit={handleSignupStep2}>
                  <div style={{marginBottom:20}}>
                    <input
                      className="otp-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="• • • • • •"
                      value={otp}
                      onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))}
                      autoFocus
                    />
                  </div>
                  <button className="submit-btn" type="submit" disabled={loading||otp.length!==6}>
                    {loading&&<span className="spinner"/>}{loading?"Creating account...":"Verify & Create Account"}
                  </button>
                </form>
                <div className="switch-mode" style={{color:"rgba(245,239,245,.2)"}}>
                  Didn&apos;t receive a code?
                  <button onClick={()=>showToast("Code resent! (Placeholder — use 123456)","info")} style={{color:"rgba(200,164,196,.6)"}}>Resend</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div style={{minHeight:"100vh",background:"#0a0608"}}/>}>
      <AuthContent/>
    </Suspense>
  );
}
