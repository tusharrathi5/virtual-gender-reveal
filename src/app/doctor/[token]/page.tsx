"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
type Gender = "boy" | "girl";
export default function DoctorTokenPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Gender | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submitGender(gender: Gender) {
    if (!token) return;
    const ok = window.confirm(`Please confirm: you are submitting ${gender.toUpperCase()}. This cannot be changed.`);
    if (!ok) return;
    setLoading(true); setError(null); setSelected(gender);
    try {
      const res = await fetch(`/api/doctor/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gender }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to submit gender.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit.");
    } finally { setLoading(false); }
  }
  if (!token) return <div style={{ padding: 24 }}>Invalid link.</div>;
  if (done) return <div style={{ maxWidth: 560, margin: "48px auto", padding: 24, fontFamily: "Inter, Arial, sans-serif" }}><h1>Submission received ✅</h1><p>Thank you. The gender has been securely submitted.</p></div>;
  return <div style={{ maxWidth: 560, margin: "48px auto", padding: 24, fontFamily: "Inter, Arial, sans-serif" }}><h1>Submit Baby Gender</h1><p>Select one option below, then confirm your submission.</p><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}><button disabled={loading} onClick={() => submitGender("boy")} style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid #ddd", background: selected === "boy" ? "#dbeafe" : "#fff", cursor: "pointer" }}>👦 Boy</button><button disabled={loading} onClick={() => submitGender("girl")} style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid #ddd", background: selected === "girl" ? "#fce7f3" : "#fff", cursor: "pointer" }}>👧 Girl</button></div>{error && <p style={{ color: "#b91c1c", marginTop: 14 }}>{error}</p>}{loading && <p style={{ marginTop: 14 }}>Submitting…</p>}</div>;
}
