"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Gender = "boy" | "girl";

export default function DoctorTokenPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [selected, setSelected] = useState<Gender | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const res = await fetch(`/api/doctor/${token}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Invalid or expired link");
      }
      setValidating(false);
    })();
  }, [token]);

  async function submitGender(gender: Gender) {
    if (!token || validating) return;
    const ok = window.confirm(`Please confirm: you are submitting ${gender.toUpperCase()}. This cannot be changed.`);
    if (!ok) return;

    setLoading(true);
    setError(null);
    setSelected(gender);

    try {
      const res = await fetch(`/api/doctor/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gender }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to submit gender.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="doctor-shell">
      <div className="doctor-card">
        <h1>Secure Gender Submission</h1>
        <p className="doctor-sub">Choose one option and confirm. This action is one-time and secure.</p>

        {done ? (
          <div className="doctor-success">Thank you. Your submission has been recorded securely ✅</div>
        ) : (
          <div className="doctor-grid">
            <button disabled={loading || validating || !!error} onClick={() => submitGender("boy")} className={`doctor-btn boy ${selected === "boy" ? "active" : ""}`}>👦 Boy</button>
            <button disabled={loading || validating || !!error} onClick={() => submitGender("girl")} className={`doctor-btn girl ${selected === "girl" ? "active" : ""}`}>👧 Girl</button>
          </div>
        )}

        {validating && <p className="doctor-muted">Validating secure link…</p>}
        {loading && <p className="doctor-muted">Submitting…</p>}
        {error && <p className="doctor-error">{error}</p>}
      </div>

      <style jsx>{`
        .doctor-shell { min-height: 100vh; display:flex; align-items:center; justify-content:center; padding:24px; background: radial-gradient(circle at top, #fdf2ff 0%, #eef2ff 45%, #ffffff 100%); }
        .doctor-card { width:100%; max-width:760px; background:#fff; border:1px solid #e5e7eb; border-radius:20px; padding:32px; box-shadow:0 20px 55px rgba(67,56,202,.1); }
        h1 { margin:0; font-size:36px; color:#312e81; font-weight:800; }
        .doctor-sub { margin:10px 0 22px; color:#4b5563; font-size:16px; }
        .doctor-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .doctor-btn { padding:16px; border-radius:14px; border:1px solid #d1d5db; font-size:28px; font-weight:700; cursor:pointer; background:#fff; transition:all .18s ease; }
        .doctor-btn:hover { transform:translateY(-1px); box-shadow:0 10px 24px rgba(79,70,229,.12); }
        .doctor-btn.boy.active { background:#dbeafe; border-color:#93c5fd; }
        .doctor-btn.girl.active { background:#fce7f3; border-color:#f9a8d4; }
        .doctor-btn:disabled { opacity:.6; cursor:not-allowed; }
        .doctor-muted { color:#6b7280; margin-top:14px; }
        .doctor-error { color:#b91c1c; margin-top:14px; font-weight:600; }
        .doctor-success { margin-top:14px; padding:14px 16px; border-radius:12px; background:#ecfdf5; color:#065f46; font-weight:700; border:1px solid #a7f3d0; }
        @media (max-width: 760px) { h1 { font-size:30px; } .doctor-grid { grid-template-columns:1fr; } }
      `}</style>
    </main>
  );
}
