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

function AuthContent() {
  const router = useRouter();
  const { loginWithEmail, resetPassword } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  function showToast(message: string, type: ToastType) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        await loginWithEmail(email, password);
        router.push("/dashboard");
      } else {
        showToast("Registration is currently handled via Sign In for this demo.", "info");
      }
    } catch (err: any) {
      showToast(err.message || "Authentication failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) return showToast("Enter your email first", "info");
    setLoading(true);
    try {
      await resetPassword(email);
      showToast("Reset link sent!", "success");
      setShowReset(false);
    } catch (err: any) {
      showToast("Failed to send reset link", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500&display=swap');
        .auth-root{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Jost',sans-serif;background:#0a0608;color:#f5eff5}
        .form-card{width:100%;max-width:400px;background:rgba(255,255,255,0.02);padding:40px;border-radius:20px;border:1px solid rgba(255,255,255,0.05);backdrop-filter:blur(10px)}
        .field{margin-bottom:20px}
        .field label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;color:rgba(245,239,245,0.5)}
        .field input{width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;outline:none}
        .submit-btn{width:100%;padding:14px;background:#c8a4c4;border:none;border-radius:8px;color:#0a0608;font-weight:600;cursor:pointer}
        .mode-toggle{display:flex;gap:10px;margin-bottom:30px}
        .mode-btn{flex:1;padding:10px;background:none;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);border-radius:8px;cursor:pointer}
        .mode-btn.active{border-color:#c8a4c4;color:#c8a4c4;background:rgba(200,164,196,0.1)}
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="form-card">
        <div className="mode-toggle">
          <button className={`mode-btn ${mode === "signin" ? "active" : ""}`} onClick={() => setMode("signin")}>Sign In</button>
          <button className={`mode-btn ${mode === "signup" ? "active" : ""}`} onClick={() => setMode("signup")}>Register</button>
        </div>

        <form onSubmit={handleAuth}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Processing..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <span onClick={() => setShowReset(!showReset)} style={{ cursor: "pointer", fontSize: "12px", textDecoration: "underline", color: "rgba(255,255,255,0.3)" }}>
            {showReset ? "Back to Login" : "Forgot Password?"}
          </span>
          {showReset && (
            <button type="button" onClick={handleReset} className="submit-btn" style={{ marginTop: '15px', background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
              Send Reset Link
            </button>
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
