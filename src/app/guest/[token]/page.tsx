"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

type Prediction = "boy" | "girl" | null;
type ChatMessage = {
  id: string;
  name: string;
  message: string;
  createdAtIso: string | null;
};

function formatChatTime(iso: string | null) {
  if (!iso) return "just now";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export default function GuestInvitePage() {
  const { token } = useParams<{ token: string }>();
  const encodedToken = useMemo(() => encodeURIComponent(token || ""), [token]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [guestName, setGuestName] = useState("Guest");
  const [parentName, setParentName] = useState("Parents");
  const [revealAtIso, setRevealAtIso] = useState<string | null>(null);
  const [revealTimezone, setRevealTimezone] = useState("UTC");
  const [isLive, setIsLive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [feed, setFeed] = useState<Array<{ name: string; message: string }>>([]);
  const [invitedGuests, setInvitedGuests] = useState<Array<{ name: string }>>([]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatSending, setChatSending] = useState(false);
  const [chatStatus, setChatStatus] = useState<"connecting" | "live" | "reconnecting">("connecting");

  const [prediction, setPrediction] = useState<Prediction>(null);
  const [message, setMessage] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadInvite = useCallback(async () => {
    const res = await fetch(`/api/guest/${encodedToken}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "Invalid invite");
      setLoading(false);
      return;
    }

    setGuestName(data?.guest?.name || "Guest");
    setParentName(data?.reveal?.parentName || "Parents");
    setRevealAtIso(data?.reveal?.revealAtIso || null);
    setRevealTimezone(data?.reveal?.revealTimezone || "UTC");
    setIsLive(Boolean(data?.reveal?.isLive));
    setIsCompleted(Boolean(data?.reveal?.isCompleted));
    setVideoUrl(data?.reveal?.videoUrl || null);
    setFeed(Array.isArray(data?.feed) ? data.feed : []);
    setInvitedGuests(Array.isArray(data?.invitedGuests) ? data.invitedGuests : []);

    if (data?.response?.prediction === "boy" || data?.response?.prediction === "girl") {
      setPrediction(data.response.prediction);
      setMessage(data?.response?.message || "");
      setDone(true);
    }
    setLoading(false);
  }, [encodedToken]);

  useEffect(() => {
    if (!encodedToken) return;
    (async () => {
      await loadInvite();
    })();
    const refresh = setInterval(() => {
      loadInvite().catch(() => {});
    }, 30000);
    return () => clearInterval(refresh);
  }, [encodedToken, loadInvite]);

  useEffect(() => {
    if (!encodedToken) return;

    let closed = false;
    const stream = new EventSource(`/api/guest/${encodedToken}/chat/stream`);
    setChatStatus("connecting");

    stream.onopen = () => {
      if (!closed) setChatStatus("live");
    };
    stream.addEventListener("messages", (event) => {
      if (closed) return;
      try {
        const messages = JSON.parse(event.data) as ChatMessage[];
        setChatMessages(Array.isArray(messages) ? messages : []);
        setChatStatus("live");
        setChatError(null);
      } catch {
        setChatError("Chat messages could not be loaded.");
      }
    });
    stream.addEventListener("stream-error", () => {
      if (!closed) setChatError("Chat temporarily disconnected. Reconnecting...");
    });
    stream.onerror = () => {
      if (!closed) setChatStatus("reconnecting");
    };

    return () => {
      closed = true;
      stream.close();
    };
  }, [encodedToken]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages.length]);

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


  const googleCalendarUrl = useMemo(() => {
    if (!revealAtIso) return null;
    const start = new Date(revealAtIso);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const text = encodeURIComponent(`${parentName}'s Virtual Gender Reveal`);
    const details = encodeURIComponent(`Join the reveal: ${window?.location?.href || ""}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(start)}/${fmt(end)}&ctz=${encodeURIComponent(revealTimezone)}&details=${details}`;
  }, [revealAtIso, parentName, revealTimezone]);
  async function submitPrediction() {
    if (!prediction) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/guest/${encodedToken}`, {
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

  async function submitChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextMessage = chatText.trim();
    if (!nextMessage || chatSending || isCompleted) return;

    setChatSending(true);
    setChatError(null);
    const res = await fetch(`/api/guest/${encodedToken}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: nextMessage }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setChatError(data?.error || "Could not send that message.");
      setChatSending(false);
      return;
    }
    setChatText("");
    setChatSending(false);
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
          <p style={{ margin: "4px 0 0", color: "#9ca3af", fontSize: 13 }}>Reveal timezone: {revealTimezone}</p>
          {googleCalendarUrl && (<p style={{ margin: "6px 0 0", display: "flex", gap: 10, justifyContent: "center" }}><a href={googleCalendarUrl} target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", fontSize: 13 }}>Add to Google Calendar</a><a href={`/api/guest/${encodedToken}/calendar.ics`} style={{ color: "#1d4ed8", fontSize: 13 }}>Download ICS (Apple/Outlook)</a></p>)}
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
            ) : isCompleted ? (
              <p style={{ color: "#6b7280" }}>This reveal event has completed. Thanks for joining 💛</p>
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

        <section style={{ marginTop: 14, background: "#fff", border: "1px solid #ece6ee", borderRadius: 14, padding: 14 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Who's invited</h3>
          <p style={{ color: "#6b7280", marginTop: 6 }}>Everyone on the guest list for this reveal.</p>
          {invitedGuests.length === 0 ? (
            <p style={{ color: "#9ca3af" }}>No guest names are available yet.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {invitedGuests.map((guest, idx) => (
                <span
                  key={`${guest.name}-${idx}`}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 999,
                    padding: "7px 10px",
                    background: "#f9fafb",
                    color: "#374151",
                    fontSize: 14,
                  }}
                >
                  {guest.name}
                </span>
              ))}
            </div>
          )}
        </section>

        <section style={{ marginTop: 14, background: "#fff", border: "1px solid #ece6ee", borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>Live party chat</h3>
              <p style={{ color: "#6b7280", margin: "6px 0 0" }}>Realtime messages from invited guests in this reveal room.</p>
            </div>
            <span
              style={{
                flexShrink: 0,
                borderRadius: 999,
                padding: "5px 9px",
                fontSize: 12,
                color: chatStatus === "live" ? "#166534" : "#92400e",
                background: chatStatus === "live" ? "#dcfce7" : "#fef3c7",
              }}
            >
              {chatStatus === "live" ? "Live" : chatStatus === "connecting" ? "Connecting" : "Reconnecting"}
            </span>
          </div>

          <div style={{ height: 260, overflowY: "auto", padding: "8px 4px 8px 0", marginTop: 10 }}>
            {chatMessages.length === 0 ? (
              <p style={{ color: "#9ca3af" }}>No chat messages yet.</p>
            ) : (
              chatMessages.map((item) => (
                <div key={item.id} style={{ borderBottom: "1px solid #f3f4f6", padding: "9px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong style={{ color: "#1f2937" }}>{item.name}</strong>
                    <span style={{ color: "#9ca3af", fontSize: 12 }}>{formatChatTime(item.createdAtIso)}</span>
                  </div>
                  <p style={{ margin: "4px 0 0", color: "#374151", overflowWrap: "anywhere" }}>{item.message}</p>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={submitChat} style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              type="text"
              value={chatText}
              maxLength={500}
              onChange={(e) => setChatText(e.target.value)}
              disabled={isCompleted}
              placeholder={isCompleted ? "Chat is closed" : "Send a message to the party"}
              style={{
                flex: 1,
                minWidth: 0,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: "11px 12px",
              }}
            />
            <button
              type="submit"
              disabled={!chatText.trim() || chatSending || isCompleted}
              style={{
                border: 0,
                borderRadius: 12,
                padding: "0 16px",
                color: "#fff",
                fontWeight: 700,
                background: "#1f2937",
                opacity: !chatText.trim() || chatSending || isCompleted ? 0.6 : 1,
              }}
            >
              {chatSending ? "Sending" : "Send"}
            </button>
          </form>
          {chatError && <p style={{ color: "#b91c1c", margin: "8px 0 0" }}>{chatError}</p>}
        </section>

        <section style={{ marginTop: 14, background: "#fff", border: "1px solid #ece6ee", borderRadius: 14, padding: 14 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Guest wishes</h3>
          <p style={{ color: "#6b7280", marginTop: 6 }}>Prediction messages saved for the parents.</p>
          <div style={{ maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
            {feed.length === 0 ? (
              <p style={{ color: "#9ca3af" }}>No guest wishes yet.</p>
            ) : (
              feed.map((item, idx) => (
                <div key={`${item.name}-${idx}`} style={{ borderBottom: "1px solid #f3f4f6", padding: "8px 0" }}>
                  <strong>{item.name}:</strong> {item.message}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
