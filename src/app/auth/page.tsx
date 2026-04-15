"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

type ToastType = "success" | "error" | "info";

function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  const colors: Record<ToastType, string> = { success: "#22c55e", error: "#ef4444", info: "#c8a4c4" };
  const icons: Record<ToastType, string> = { success: "✓", error: "✕", info: "✦" };
  return (
    <div style={{
      position:"fixed",top:24,right:24,zIndex:9999,display:"flex",alignItems:"flex-start",gap:12,
      background:"#1a1018",border:`1px solid ${colors[type]}40`,borderLeft:`3px solid ${colors[type]}`,
      borderRadius:10,padding:"14px 18px",maxWidth:360,boxShadow:"0 8px 30px rgba(0,0,0,0.4)",
      animation:"slideIn 0.3s ease-out",
    }}>
      <span style={{color:colors[type],fontSize:16,fontWeight:700,marginTop:1,flexShrink:0}}>{icons[type]}</span>
      <span style={{color:"#f5eff5",fontSize:13,fontWeight:300,lineHeight:1.5,flex:1}}>{message}</span>
      <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(245,239,245,0.3)",cursor:"pointer",fontSize:18,padding:0,marginLeft:8,lineHeight:1}}>×</button>
    </div>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState<"signin"|"signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
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
      return "No account found with this email and password. Please check your details or sign up.";
    if (msg.includes("wrong-password")) return "Incorrect password. Please try again.";
    if (msg.includes("email-already-in-use")) return "An account with this email already exists. Please sign in instead.";
    if (msg.includes("weak-password")) return "Password must be at least 6 characters long.";
    if (msg.includes("invalid-email")) return "Please enter a valid email address.";
    if (msg.includes("too-many-requests")) return "Too many attempts. Please wait a moment before trying again.";
    if (msg.includes("network-request-failed")) return "Network error. Please check your internet connection.";
    if (msg.includes("popup-closed-by-user")) return "Sign-in was cancelled. Please try again.";
    if (msg.includes("popup-blocked")) return "Popup was blocked. Please allow popups for this site.";
    return msg.replace("Firebase: ","").replace(/\s*\(auth\/.*?\)\.?/,"").trim();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && !displayName.trim()) {
      showToast("Please enter your full name.", "error"); return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        await registerWithEmail(email, password);
        const firstName = displayName.trim().split(" ")[0];
        showToast(`🎉 Welcome, ${firstName}! Your account has been created successfully. Please check your email to verify your account.`, "success");
        setTimeout(() => router.push("/dashboard"), 3000);
      } else {
        await loginWithEmail(email, password);
        showToast("Welcome back! Taking you to your dashboard...", "success");
        setTimeout(() => router.push("/dashboard"), 1500);
      }
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
      showToast("Signed in with Google! Taking you to your dashboard...", "success");
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err) {
      showToast(getFirebaseError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(newMode: "signin"|"signup") {
    setMode(newMode);
    setEmail(""); setPassword(""); setDisplayName(""); setPhone(""); setToast(null);
  }

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
    @keyframes float{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(20px,-30px) scale(1.05)}66%{transform:translate(-15px,20px) scale(0.95)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
    .auth-root{min-height:100vh;display:flex;font-family:'Jost',sans-serif;background:#0a0608;position:relative;overflow:hidden}
    .blob{position:fixed;border-radius:50%;filter:blur(80px);opacity:.18;pointer-events:none;animation:float 12s ease-in-out infinite}
    .blob-1{width:500px;height:500px;background:#c8a4c4;top:-100px;left:-150px}
    .blob-2{width:400px;height:400px;background:#a4b4c8;top:40%;right:-100px;animation-delay:-4s}
    .blob-3{width:300px;height:300px;background:#c8b4a4;bottom:-50px;left:30%;animation-delay:-8s}
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
    .form-panel{flex:none;width:100%;display:flex;align-items:center;justify-content:center;padding:40px 24px;position:relative;z-index:1}
    @media(min-width:960px){.form-panel{width:480px}}
    .form-card{width:100%;max-width:400px}
    .form-logo{font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:300;letter-spacing:4px;text-transform:uppercase;color:rgba(200,164,196,.7);margin-bottom:48px;display:flex;align-items:center;gap:10px}
    .form-logo::before{content:'';display:block;width:20px;height:1px;background:rgba(200,164,196,.4)}
    .form-heading{font-family:'Cormorant Garamond',serif;font-size:38px;font-weight:300;color:#f5eff5;line-height:1.2;margin-bottom:8px}
    .form-heading em{font-style:italic;color:#c8a4c4}
    .form-subheading{font-size:13px;font-weight:300;color:rgba(245,239,245,.35);margin-bottom:36px;line-height:1.6}
    .mode-toggle{display:flex;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:3px;margin-bottom:28px;gap:3px}
    .mode-btn{flex:1;padding:10px;border:none;border-radius:6px;font-family:'Jost',sans-serif;font-size:12px;font-weight:400;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .2s;background:transparent;color:rgba(245,239,245,.35)}
    .mode-btn.active{background:rgba(200,164,196,.15);color:#c8a4c4;border:1px solid rgba(200,164,196,.2)}
    .google-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:12px;padding:13px 20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:rgba(245,239,245,.8);font-family:'Jost',sans-serif;font-size:13px;font-weight:400;cursor:pointer;transition:all .2s;margin-bottom:22px}
    .google-btn:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.18);color:#f5eff5}
    .google-btn:disabled{opacity:.4;cursor:not-allowed}
    .divider{display:flex;align-items:center;gap:16px;margin-bottom:22px}
    .divider-line{flex:1;height:1px;background:rgba(255,255,255,.07)}
    .divider-text{font-size:11px;font-weight:300;letter-spacing:2px;text-transform:uppercase;color:rgba(245,239,245,.2)}
    .field-group{display:flex;flex-direction:column;gap:12px;margin-bottom:22px}
    .field label{display:block;font-size:10px;font-weight:400;letter-spacing:2px;text-transform:uppercase;color:rgba(245,239,245,.35);margin-bottom:7px}
    .field input{width:100%;padding:12px 16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#f5eff5;font-family:'Jost',sans-serif;font-size:14px;font-weight:300;outline:none;transition:all .2s}
    .field input::placeholder{color:rgba(245,239,245,.18)}
    .field input:focus{border-color:rgba(200,164,196,.35);background:rgba(200,164,196,.04);box-shadow:0 0 0 3px rgba(200,164,196,.06)}
    .phone-row{display:flex;gap:8px}
    .phone-prefix{padding:12px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:rgba(245,239,245,.4);font-family:'Jost',sans-serif;font-size:13px;white-space:nowrap;flex-shrink:0}
    .phone-input{flex:1;padding:12px 16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#f5eff5;font-family:'Jost',sans-serif;font-size:14px;font-weight:300;outline:none;transition:all .2s}
    .phone-input::placeholder{color:rgba(245,239,245,.18)}
    .phone-input:focus{border-color:rgba(200,164,196,.35);background:rgba(200,164,196,.04);box-shadow:0 0 0 3px rgba(200,164,196,.06)}
    .optional-badge{font-size:9px;letter-spacing:1px;color:rgba(245,239,245,.2);margin-left:6px;font-weight:300;text-transform:uppercase;font-family:'Jost',sans-serif}
    .submit-btn{width:100%;padding:15px 20px;background:linear-gradient(135deg,rgba(200,164,196,.9) 0%,rgba(164,140,180,.9) 100%);border:none;border-radius:10px;color:#0a0608;font-family:'Jost',sans-serif;font-size:12px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;cursor:pointer;transition:all .25s;margin-bottom:20px}
    .submit-btn:hover{background:linear-gradient(135deg,rgba(218,185,215,.95) 0%,rgba(185,160,200,.95) 100%);transform:translateY(-1px);box-shadow:0 8px 25px rgba(200,164,196,.25)}
    .submit-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
    .switch-mode{text-align:center;font-size:12px;font-weight:300;color:rgba(245,239,245,.3)}
    .switch-mode button{background:none;border:none;color:#c8a4c4;cursor:pointer;font-family:'Jost',sans-serif;font-size:12px;font-weight:400;text-decoration:underline;text-underline-offset:3px;padding:0;margin-left:4px}
    .spinner{display:inline-block;width:13px;height:13px;border:2px solid rgba(10,6,8,.3);border-top-color:#0a0608;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:8px}
    .field-enter{animation:slideDown .25s ease-out}
  `;

  return (
    <>
      <style>{CSS}</style>
      {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)} />}

      <div className="auth-root">
        <div className="blob blob-1" /><div className="blob blob-2" /><div className="blob blob-3" />

        {/* Brand Panel */}
        <div className="brand-panel">
          <div className="brand-pattern" />
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:11,letterSpacing:4,textTransform:"uppercase",color:"rgba(200,164,196,0.5)",marginBottom:32}}>Virtual Gender Reveal</div>
            <h1 className="brand-title">The most <em>magical</em><br />reveal of your<br />life, online.</h1>
            <div className="brand-ornament" />
            <p className="brand-tagline">Where moments become memories</p>
          </div>
          <div className="brand-features">
            {[
              {title:"Encrypted Gender Vault",desc:"Your doctor submits the gender through a secure, one-time link. Only revealed at your chosen moment."},
              {title:"Live Cinematic Reveal",desc:"Friends and family watch together — anywhere in the world — as the reveal unfolds in real time."},
              {title:"Beautifully Curated",desc:"Every reveal is choreographed with cinematic animations crafted for the moment that changes everything."},
            ].map(f=>(
              <div className="brand-feature" key={f.title}>
                <div className="feature-dot" />
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
            <h2 className="form-heading">
              {mode==="signin"?<>Welcome<br /><em>back.</em></>:<>Begin your<br /><em>journey.</em></>}
            </h2>
            <p className="form-subheading">
              {mode==="signin"
                ?"Sign in to manage your reveal and check your baby's secret."
                :"Create your account and start planning the most magical reveal of your lives."}
            </p>

            <div className="mode-toggle">
              <button className={`mode-btn${mode==="signin"?" active":""}`} onClick={()=>switchMode("signin")}>Sign In</button>
              <button className={`mode-btn${mode==="signup"?" active":""}`} onClick={()=>switchMode("signup")}>Create Account</button>
            </div>

            <button className="google-btn" onClick={handleGoogle} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="divider">
              <div className="divider-line" /><span className="divider-text">or</span><div className="divider-line" />
            </div>

            <form onSubmit={handleSubmit}>
              <div className="field-group">
                {mode==="signup" && (
                  <div className="field field-enter">
                    <label>Full Name</label>
                    <input type="text" placeholder="e.g. Sarah & James" value={displayName} onChange={e=>setDisplayName(e.target.value)} required />
                  </div>
                )}
                <div className="field">
                  <label>Email Address</label>
                  <input type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required />
                </div>
                {mode==="signup" && (
                  <div className="field field-enter">
                    <label>Phone Number <span className="optional-badge">optional</span></label>
                    <div className="phone-row">
                      <div className="phone-prefix">+1</div>
                      <input className="phone-input" type="tel" placeholder="(555) 000-0000" value={phone} onChange={e=>setPhone(e.target.value)} />
                    </div>
                  </div>
                )}
                <div className="field">
                  <label>Password</label>
                  <input type="password" placeholder={mode==="signup"?"Min. 6 characters":"Your password"} value={password} onChange={e=>setPassword(e.target.value)} required minLength={mode==="signup"?6:undefined} />
                </div>
              </div>

              <button className="submit-btn" type="submit" disabled={loading}>
                {loading&&<span className="spinner"/>}
                {loading?(mode==="signin"?"Signing in...":"Creating account..."):(mode==="signin"?"Sign In":"Create Account")}
              </button>
            </form>

            <div className="switch-mode">
              {mode==="signin"
                ?<>Don&apos;t have an account?<button onClick={()=>switchMode("signup")}>Sign up free</button></>
                :<>Already have an account?<button onClick={()=>switchMode("signin")}>Sign in</button></>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
