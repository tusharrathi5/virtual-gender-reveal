"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

export default function GuestInvitePage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [guestName, setGuestName] = useState("Guest");
  const [parentName, setParentName] = useState("Parents");
  const [revealAtIso, setRevealAtIso] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<"boy"|"girl"|null>(null);
  const [message, setMessage] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/guest/${token}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error || "Invalid invite"); setLoading(false); return; }
      setGuestName(data?.guest?.name || "Guest");
      setParentName(data?.reveal?.parentName || "Parents");
      setRevealAtIso(data?.reveal?.revealAtIso || null);
      setLoading(false);
    })();
  }, [token]);

  const countdown = useMemo(() => {
    if (!revealAtIso) return "Schedule pending";
    const diff = new Date(revealAtIso).getTime() - nowMs;
    if (diff <= 0) return "Reveal is live now 🎉";
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `Reveal in ${d}d ${h}h ${m}m ${s}s`;
  }, [revealAtIso, nowMs]);

  async function submit() {
    if (!prediction) return;
    setSubmitting(true); setError(null);
    const res = await fetch(`/api/guest/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prediction, message }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data?.error || "Failed"); setSubmitting(false); return; }
    setDone(true); setSubmitting(false);
  }

  return <main style={{ minHeight:"100vh", background:"linear-gradient(180deg,#fdf2f8,#eef2ff)", padding:24, display:"flex", justifyContent:"center", alignItems:"center" }}><div style={{ maxWidth:760, width:"100%", background:"#fff", borderRadius:20, padding:28, border:"1px solid #e5e7eb" }}><h1 style={{ fontSize:40, color:"#312e81" }}>You're Invited 🎉</h1><p>Hi {guestName}, {parentName} invited you to the reveal party.</p><p style={{ fontWeight:700 }}>{countdown}</p>{loading ? <p>Loading invite…</p> : done ? <p style={{ color:"#15803d" }}>Thanks! Your prediction and message are saved.</p> : <><div style={{ display:"flex", gap:10, marginTop:8 }}><button onClick={()=>setPrediction("boy")} style={{ flex:1, padding:14, borderRadius:12, border:"1px solid #ddd", background: prediction==="boy"?"#dbeafe":"#fff" }}>💙 Boy</button><button onClick={()=>setPrediction("girl")} style={{ flex:1, padding:14, borderRadius:12, border:"1px solid #ddd", background: prediction==="girl"?"#fce7f3":"#fff" }}>🩷 Girl</button></div><textarea placeholder="Write a message for the parents…" value={message} onChange={(e)=>setMessage(e.target.value)} style={{ width:"100%", marginTop:12, minHeight:100, border:"1px solid #ddd", borderRadius:12, padding:10 }} /><button onClick={submit} disabled={!prediction||submitting} style={{ marginTop:12, width:"100%", padding:12, border:"none", borderRadius:12, background:"#2563eb", color:"#fff" }}>{submitting?"Submitting...":"Submit prediction & message"}</button></>}{error && <p style={{ color:"#b91c1c" }}>{error}</p>}</div></main>;
}
