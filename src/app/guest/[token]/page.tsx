"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Prediction = "boy" | "girl" | null;

export default function GuestInvitePage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [guestName, setGuestName] = useState("Guest");
  const [parentName, setParentName] = useState("Parents");
  const [revealAtIso, setRevealAtIso] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [prediction, setPrediction] = useState<Prediction>(null);
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
      if (!res.ok) {
        setError(data?.error || "Invalid invite");
        setLoading(false);
        return;
      }

      setGuestName(data?.guest?.name || "Guest");
      setParentName(data?.reveal?.parentName || "Parents");
      setRevealAtIso(data?.reveal?.revealAtIso || null);
      setIsLive(Boolean(data?.reveal?.isLive));
      setVideoUrl(data?.reveal?.videoUrl || null);

      if (data?.response?.prediction === "boy" || data?.response?.prediction === "girl") {
        setPrediction(data.response.prediction);
        setMessage(data?.response?.message || "");
        setDone(true);
      }
      setLoading(false);
    })();
  }, [token]);

  const countdownParts = useMemo(() => {
    if (!revealAtIso) return { d: 0, h: 0, m: 0, s: 0, live: false };
    const diff = new Date(revealAtIso).getTime() - nowMs;
    if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, live: true };
    return {
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff % 86400000) / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
      live: false,
    };
  }, [revealAtIso, nowMs]);

  const countdownLabel = countdownParts.live
    ? "Reveal is live now 🎉"
    : `Reveal in ${countdownParts.d}d ${countdownParts.h}h ${countdownParts.m}m ${countdownParts.s}s`;

  async function submitPrediction() {
    if (!prediction) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/guest/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prediction, message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "Failed to save your prediction.");
      setSubmitting(false);
      return;
    }
    setDone(true);
    setSubmitting(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "24px 16px 48px",
        background:
          "radial-gradient(circle at top left, rgba(108,142,239,.18), transparent 40%), radial-gradient(circle at top right, rgba(236,144,198,.18), transparent 35%), #fffefb",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <header
          style={{
            borderRadius: 14,
            padding: "14px 18px",
            background: "linear-gradient(90deg, rgba(108,142,239,.15), rgba(236,144,198,.15))",
            border: "1px solid rgba(236,144,198,.25)",
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: "#1f2937" }}>
            {parentName}&apos;s Virtual Gender Reveal
          </h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280" }}>Hi {guestName}, welcome to the celebration ✨</p>
        </header>

        <section
          style={{
            background: "#fff",
            border: "1px solid #ece6ee",
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "0 12px 24px rgba(18,18,23,.08)",
          }}
        >
          <div style={{ position: "relative", aspectRatio: "16 / 9", background: "#111827" }}>
            {isLive && videoUrl ? (
              <iframe
                src={videoUrl}
                title="Reveal Video"
                style={{ width: "100%", height: "100%", border: 0 }}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  color: "#fff",
                  background: "linear-gradient(160deg, #1f2937 0%, #374151 100%)",
                }}
              >
                <div style={{ textAlign: "center", padding: 20 }}>
                  <div style={{ fontSize: 16, opacity: 0.9 }}>THE REVEAL LIVE</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>{countdownLabel}</div>
                  <div style={{ marginTop: 10, opacity: 0.85 }}>
                    The video screen unlocks automatically at reveal time.
                  </div>
                </div>
              </div>
            )}

            {!isLive && (
              <div
                style={{
                  position: "absolute",
                  left: 14,
                  bottom: 12,
                  fontSize: 13,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "rgba(0,0,0,.6)",
                  color: "#fff",
                }}
              >
                Countdown Active
              </div>
            )}
          </div>

          <div style={{ padding: 18, borderTop: "1px solid #f3f4f6" }}>
            <h2 style={{ margin: 0, fontSize: 22, color: "#1f2937" }}>Prediction & wishes</h2>
            <p style={{ margin: "8px 0 12px", color: "#6b7280" }}>
              {isLive
                ? "Drop your prediction and blessing for the parents."
                : "Prediction form unlocks at reveal time to keep the suspense alive."}
            </p>

            {loading ? (
              <p style={{ color: "#6b7280" }}>Loading invite…</p>
            ) : done ? (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, color: "#166534", fontWeight: 700 }}>Thanks! Your response is saved.</p>
                <p style={{ margin: "8px 0 0", color: "#14532d" }}>
                  Prediction: <strong>{prediction === "boy" ? "Boy 💙" : "Girl 🩷"}</strong>
                </p>
                {message ? <p style={{ margin: "6px 0 0", color: "#14532d" }}>Note: {message}</p> : null}
              </div>
            ) : !isLive ? (
              <p style={{ color: "#6b7280" }}>{countdownLabel}</p>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    onClick={() => setPrediction("boy")}
                    style={{
                      border: "1px solid #93c5fd",
                      borderRadius: 12,
                      padding: 14,
                      background: prediction === "boy" ? "#dbeafe" : "#fff",
                      fontWeight: 700,
                    }}
                  >
                    💙 Team Boy
                  </button>
                  <button
                    onClick={() => setPrediction("girl")}
                    style={{
                      border: "1px solid #f9a8d4",
                      borderRadius: 12,
                      padding: 14,
                      background: prediction === "girl" ? "#fce7f3" : "#fff",
                      fontWeight: 700,
                    }}
                  >
                    🩷 Team Girl
                  </button>
                </div>
                <textarea
                  placeholder="Share a message for the parents…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  style={{ width: "100%", minHeight: 100, marginTop: 12, borderRadius: 12, border: "1px solid #e5e7eb", padding: 10 }}
                />
                <button
                  onClick={submitPrediction}
                  disabled={!prediction || submitting}
                  style={{
                    marginTop: 10,
                    border: 0,
                    borderRadius: 12,
                    padding: "12px 18px",
                    color: "#fff",
                    fontWeight: 700,
                    background: "linear-gradient(90deg,#6c8eef,#ec90c6)",
                  }}
                >
                  {submitting ? "Saving…" : "Submit Prediction"}
                </button>
              </>
            )}
            {error && <p style={{ color: "#b91c1c", marginTop: 8 }}>{error}</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
