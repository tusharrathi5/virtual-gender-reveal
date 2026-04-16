"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

type ToastType = "success" | "error" | "info";

function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  const colors: Record<ToastType, string> = { success: "#22c55e", error: "#ef4444", info: "#c8a4c4" };
  const icons: Record<ToastType, string> = { success: "✓", error: "✕", info: "✦" };
  return (
    <div style={{
      position: "fixed", top: 24, right: 24, zIndex: 9999,
      display: "flex", alignItems: "flex-start", gap: 12,
      background: "#1a1018", border: `1px solid ${colors[type]}40`,
      borderLeft: `3px solid ${colors[type]}`,
      borderRadius: 10, padding: "14px 18px", maxWidth: 380,
      boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
      animation: "slideIn 0.3s ease-out", fontFamily: "'Jost',sans-serif",
    }}>
      <span style={{ color: colors[type], fontSize: 16, fontWeight: 700, marginTop: 1, flexShrink: 0 }}>{icons[type]}</span>
      <span style={{ color: "#f5eff5", fontSize: 13, fontWeight: 300, lineHeight: 1.5, flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(245,239,245,0.3)", cursor: "pointer", fontSize: 18, padding: 0, marginLeft: 8, lineHeight: 1 }}>×</button>
    </div>
  );
}

function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
}

function isValidPhone(phone: string): boolean {
  return /^\+?[\d\s-().]{7,20}$/.test(phone.trim()) && phone.replace(/\D/g, "").length >= 7;
}

function AuthContent() {
  const router = useRouter();
  const { user, loading: authLoading, loginWithEmail, registerWithEmail, logout, resetPassword } = useAuth();

  // State Definitions
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [signupStep, setSignupStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [intendedPlan, setIntendedPlan] = useState("");
  const [redirectPath, setRedirectPath] = useState("/dashboard");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    if (redirect) setRedirectPath(redirect);
    
    const plan = sessionStorage.getItem("vgr_intended_plan");
    if (plan) setIntendedPlan(plan);
  }, []);

  function showToast(message: string, type: ToastType) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isValidEmail(email)) return showToast("Invalid email address", "error");
    
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      router.push(redirectPath);
    } catch (err: any) {
      showToast(err.message || "Login failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) return showToast("Enter your email first", "info");
    setLoading(true);
    try {
      await resetPassword(email);
      showToast("Reset link sent to your email", "success");
      setShowReset(false);
    } catch (err: any) {
      showToast("Failed to send reset link", "error");
    } finally {
      setLoading(false);
    }
  };

  function switchMode(m: "signin" | "signup") {
    setMode(m);
    setSignupStep(1);
    setEmail(""); setPassword(""); setDisplayName(""); setPhone(""); setOtp("");
  }

  return (
    <div className="auth-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500&display=swap');
        .auth-root{min-height:100vh;display:flex;font-family:'Jost',sans-serif;background:#0a0608;position:relative;overflow:hidden;color:#f5eff5}
        .form-panel{flex:1;display:flex;align-items:center;justify-content:center;padding:24px;z-index:1}
        .form-card{width:100%;max-width:400px;background:rgba(255,255,255,0.02);padding:40px;border-radius:20px;border:1px solid rgba(255,255,255,0.05);backdrop-filter:blur(10px)}
        .field{margin-bottom:20px}
        .field label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;color:rgba(245,239,245,0.5)}
        .field input{width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;outline:none}
        .submit-btn{width:100%;padding:14px;background:#c8a4c4;border:none;border-radius:8px;color:#0a0608;font-weight:600;cursor:pointer;margin-top:10px}
        .mode-toggle{display:flex;gap:10px;margin-bottom:30px}
        .mode-btn{flex:1;padding:10px;background:none;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);border-radius:8px;cursor:pointer}
        .mode-btn.active{border-color:#c8a4c4;color:#c8a4c4;background:rgba(200,164,196,0.1)}
        .switch-mode{text-align:center;margin-top:20px;font-size:13px;color:rgba(255,255,255,0.3)}
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="form-panel">
        <div className="form-card">
          <div className="mode-toggle">
            <button className={`mode-btn ${mode === "signin" ? "active" : ""}`} onClick={() => switchMode("signin")}>Sign In</button>
            <button className={`mode-btn ${mode === "signup" ? "active" : ""}`} onClick={() => switchMode("signup")}>Register</button>
          </div>

          <form onSubmit={handleSignin}>
            <div className="field">
              <label>Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@example.com" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "Processing..." : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {mode === "signin" && (
            <div className="switch-mode">
              <span onClick={() => setShowReset(!showReset)} style={{ cursor: "pointer", textDecoration: "underline" }}>
                {showReset ? "Back to Login" : "Forgot Password?"}
              </span>
              {showReset && (
                <button onClick={handleReset} className="submit-btn" style={{ marginTop: '15px', background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                  Send Reset Link
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0a0608" }} />}>
      <AuthContent />
    </Suspense>
  );
}
