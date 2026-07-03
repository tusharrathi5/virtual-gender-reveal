"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Sparkles, Calendar, Send, Heart, Users, MessageSquare, Clock, Globe } from "lucide-react";

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
  const [showCalendarOptions, setShowCalendarOptions] = useState(false);

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
  const icsUrl = useMemo(() => `/api/guest/${encodedToken}/calendar.ics`, [encodedToken]);
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
    <>
      <style>{`
        .party-bg-video {
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .party-bg-video {
            display: none !important;
          }
          .party-overlay {
            background: linear-gradient(135deg, rgba(232, 68, 154, 0.08) 0%, rgba(58, 159, 232, 0.08) 100%), #fffefb !important;
          }
        }
      `}</style>

      <div className="relative min-h-screen overflow-x-hidden w-full font-sans antialiased text-[#1f2937]">
        {/* Decorative Fixed Video Background */}
        <video
          src="/videos/party-page-background.mp4"
          autoPlay
          loop
          muted
          playsInline
          controls={false}
          aria-hidden="true"
          className="party-bg-video fixed inset-0 w-full h-full object-cover z-0 pointer-events-none"
        />
        
        {/* Premium Overlay Tint */}
        <div className="party-overlay fixed inset-0 z-10 pointer-events-none bg-gradient-to-tr from-[#E8449A]/5 via-white/70 to-[#3A9FE8]/5" />
        
        {/* Main Content (z-index 20) */}
        <div className="relative z-20 max-w-[1080px] mx-auto px-4 py-8 md:py-12 flex flex-col gap-6">
          {/* 1. PARTY HERO HEADER */}
          <header className="relative overflow-hidden bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl rounded-[24px] p-6 md:p-8 text-center flex flex-col items-center gap-4">
            {/* Ambient Glows */}
            <div className="absolute top-0 left-0 w-32 h-full bg-[#E8449A]/10 blur-2xl pointer-events-none" />
            <div className="absolute top-0 right-0 w-32 h-full bg-[#3A9FE8]/10 blur-2xl pointer-events-none" />
            
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-[#E8449A]/10 to-[#3A9FE8]/10 border border-pink-200/50 text-[11px] font-bold uppercase tracking-wider text-[#c2527a]">
              ✨ Virtual Celebration ✨
            </div>
            
            <h1 className="font-extrabold text-3xl md:text-4xl text-slate-800 leading-tight">
              {parentName}&apos;s Virtual Gender Reveal
            </h1>
            
            <p className="text-sm md:text-base text-slate-600 font-medium">
              Hi <span className="font-bold text-[#c2527a]">{guestName}</span>, welcome to the celebration 🎉
            </p>
            
            <div className="flex flex-wrap justify-center items-center gap-4 text-xs font-semibold text-slate-500 mt-1">
              <span className="flex items-center gap-1.5 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200/40">
                <Globe className="w-3.5 h-3.5 text-[#3A9FE8]" />
                Timezone: {revealTimezone}
              </span>
              
              {googleCalendarUrl && (
                <button
                  type="button"
                  onClick={() => setShowCalendarOptions(true)}
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-[#3A9FE8] border border-blue-100 hover:border-blue-200 px-3 py-1.5 rounded-lg transition-all duration-200 shadow-sm font-bold"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Add to Calendar
                </button>
              )}
            </div>
          </header>

          {/* Double Column Grid on Desktop, Stacked on Mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Video + Prediction Form + Guest Wishes */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              {/* 2. REVEAL VIDEO / COUNTDOWN AREA */}
              <section className="relative overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl rounded-[24px]">
                {/* Ambient subtle celebratory pink/blue glows in the corners of navy frame */}
                <div className="absolute top-0 left-0 w-48 h-48 bg-[#E8449A]/15 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#3A9FE8]/15 blur-3xl pointer-events-none" />
                
                <div className="relative aspect-video w-full bg-slate-950">
                  {isLive && videoUrl ? (
                    <iframe
                      src={videoUrl}
                      title="Reveal Video"
                      className="w-full h-full border-0"
                      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                      allowFullScreen
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-slate-900 to-slate-950">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold tracking-wider text-slate-300 uppercase">
                          <Clock className="w-3.5 h-3.5 text-[#3A9FE8] animate-pulse" />
                          The Reveal Live
                        </div>
                        
                        <h2 className="text-2xl md:text-3xl font-extrabold text-white mt-4 tracking-tight">
                          {countdownParts.live ? "Reveal is live now 🎉" : "Ready for the big reveal?"}
                        </h2>
                        
                        {!countdownParts.live && (
                          <div className="flex gap-2.5 md:gap-4 justify-center mt-6">
                            {[
                              { val: countdownParts.d, label: "Days" },
                              { val: countdownParts.h, label: "Hours" },
                              { val: countdownParts.m, label: "Mins" },
                              { val: countdownParts.s, label: "Secs" },
                            ].map((item, idx) => (
                              <div key={idx} className="flex flex-col items-center bg-white/5 px-3 py-2 md:px-5 md:py-3 rounded-2xl border border-white/10 min-w-[64px] md:min-w-[80px] shadow-lg">
                                <span className="text-xl md:text-3xl font-extrabold text-white font-mono leading-none">{item.val}</span>
                                <span className="text-[9px] md:text-[10px] text-white/50 font-bold uppercase tracking-wider mt-1">{item.label}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <p className="mt-6 text-sm text-slate-400 max-w-md">
                          {countdownParts.live 
                            ? "We are live! The reveal stream is starting now." 
                            : "The screen will unlock automatically at the scheduled reveal time. Stay tuned!"}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {!isLive && (
                    <div className="absolute left-4 bottom-4 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[11px] font-bold text-white shadow-md">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                      Countdown Active
                    </div>
                  )}
                </div>
              </section>

              {/* 3. PREDICTION & WISHES */}
              <section className="bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl rounded-[24px] p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center">
                    <Sparkles className="w-4.5 h-4.5 text-[#E8449A]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Prediction & wishes</h2>
                    <p className="text-xs text-slate-500">
                      {isLive
                        ? "Drop your prediction and blessing for the parents."
                        : "Prediction form will unlock once the reveal starts."}
                    </p>
                  </div>
                </div>

                {loading ? (
                  <p className="text-sm text-slate-500">Loading invite details…</p>
                ) : isCompleted ? (
                  <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 text-center">
                    <p className="text-sm text-slate-600 font-semibold">This reveal event has completed. Thanks for joining 💛</p>
                  </div>
                ) : done ? (
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex flex-col gap-2">
                    <p className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                      <span>✓</span> Thanks! Your response is saved.
                    </p>
                    <div className="text-sm text-emerald-950 mt-1">
                      Prediction: <strong className={`font-bold px-3 py-0.5 rounded-full text-xs text-white ${prediction === "boy" ? "bg-[#3A9FE8]" : "bg-[#E8449A]"}`}>
                        {prediction === "boy" ? "Team Boy 💙" : "Team Girl 🩷"}
                      </strong>
                    </div>
                    {message && (
                      <p className="text-xs text-emerald-800/80 mt-1 italic">
                        Note: &ldquo;{message}&rdquo;
                      </p>
                    )}
                  </div>
                ) : !isLive ? (
                  <div className="bg-slate-50/70 border border-slate-200/40 rounded-2xl p-4 text-center">
                    <p className="text-sm text-slate-500 font-medium">{countdownLabel}</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setPrediction("boy")}
                        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all duration-300 ${
                          prediction === "boy"
                            ? "bg-blue-50 border-[#3A9FE8] text-[#3A9FE8] shadow-md shadow-[#3A9FE8]/10"
                            : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
                        }`}
                      >
                        <span className="text-2xl">💙</span>
                        <span className="font-extrabold text-sm uppercase tracking-wider">Team Boy</span>
                      </button>
                      
                      <button
                        onClick={() => setPrediction("girl")}
                        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all duration-300 ${
                          prediction === "girl"
                            ? "bg-pink-50 border-[#E8449A] text-[#E8449A] shadow-md shadow-[#E8449A]/10"
                            : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
                        }`}
                      >
                        <span className="text-2xl">🩷</span>
                        <span className="font-extrabold text-sm uppercase tracking-wider">Team Girl</span>
                      </button>
                    </div>
                    
                    <textarea
                      placeholder="Share a message for the parents…"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full min-h-[100px] rounded-2xl border border-slate-200 p-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#E8449A]/30 focus:border-[#E8449A] bg-white transition-all resize-none"
                    />
                    
                    <button
                      onClick={submitPrediction}
                      disabled={!prediction || submitting}
                      className="w-full py-3.5 bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] hover:from-[#d13787] hover:to-[#2e8fd1] disabled:opacity-50 text-white font-extrabold text-sm uppercase tracking-wider rounded-full shadow-lg shadow-[#E8449A]/20 transition-all duration-200"
                    >
                      {submitting ? "Saving…" : "Submit Prediction"}
                    </button>
                  </>
                )}
                {error && <p className="text-xs text-red-500 font-bold mt-1">⚠️ {error}</p>}
              </section>

              {/* 6. GUEST WISHES */}
              <section className="bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl rounded-[24px] p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Heart className="w-4.5 h-4.5 text-[#3A9FE8] fill-[#3A9FE8]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Guest wishes</h2>
                    <p className="text-xs text-slate-500">Prediction messages saved for the parents.</p>
                  </div>
                </div>

                {feed.length === 0 ? (
                  <p className="text-sm text-slate-400 italic text-center py-6">No guest wishes yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                    {feed.map((item, idx) => (
                      <div
                        key={`${item.name}-${idx}`}
                        className="bg-white/90 border border-slate-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200"
                      >
                        <div className="flex items-center justify-between border-b border-slate-50 pb-1.5 mb-2">
                          <span className="font-bold text-sm text-slate-800">{item.name}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed italic">&ldquo;{item.message}&rdquo;</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right Column: Guest List + Chat */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* 4. WHO'S INVITED */}
              <section className="bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl rounded-[24px] p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <Users className="w-4 h-4 text-[#3A9FE8]" />
                  <h3 className="text-base font-bold text-slate-800">Who&apos;s invited</h3>
                </div>
                <p className="text-xs text-slate-500">Everyone on the guest list for this reveal.</p>
                {invitedGuests.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No guest names are available yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {invitedGuests.map((guest, idx) => (
                      <span
                        key={`${guest.name}-${idx}`}
                        className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100/90 border border-slate-200/50 text-slate-700 shadow-sm"
                      >
                        {guest.name}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {/* 5. LIVE PARTY CHAT */}
              <section className="bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl rounded-[24px] p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4.5 h-4.5 text-[#E8449A]" />
                    <h3 className="text-base font-bold text-slate-800">Live party chat</h3>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      chatStatus === "live"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${chatStatus === "live" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                    {chatStatus === "live" ? "Live" : chatStatus === "connecting" ? "Connecting" : "Reconnecting"}
                  </span>
                </div>

                {/* Message List */}
                <div className="h-[280px] overflow-y-auto pr-1 flex flex-col gap-2.5 mt-1 bg-slate-50/50 rounded-2xl p-3 border border-slate-200/30">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                      No chat messages yet.
                    </div>
                  ) : (
                    chatMessages.map((item) => (
                      <div key={item.id} className="text-xs bg-white border border-slate-100 p-2.5 rounded-xl shadow-sm">
                        <div className="flex justify-between items-center gap-2">
                          <strong className="text-slate-800 font-bold">{item.name}</strong>
                          <span className="text-[10px] text-slate-400">{formatChatTime(item.createdAtIso)}</span>
                        </div>
                        <p className="text-slate-700 mt-1 leading-relaxed overflow-wrap-anywhere">{item.message}</p>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Send Form */}
                <form onSubmit={submitChat} className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={chatText}
                    maxLength={500}
                    onChange={(e) => setChatText(e.target.value)}
                    disabled={isCompleted}
                    placeholder={isCompleted ? "Chat is closed" : "Send a message to the party"}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#E8449A]/30 focus:border-[#E8449A] transition-all disabled:bg-slate-50"
                  />
                  <button
                    type="submit"
                    disabled={!chatText.trim() || chatSending || isCompleted}
                    className="px-4 py-2.5 bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition-all duration-200 flex items-center justify-center shrink-0"
                  >
                    {chatSending ? "Sending" : "Send"}
                  </button>
                </form>
                {chatError && <p className="text-[10px] text-red-500 font-bold mt-1">⚠️ {chatError}</p>}
              </section>
            </div>
          </div>
        </div>

        {/* Calendar Selection Dialog Modal */}
        {showCalendarOptions && (
          <div
            onClick={() => setShowCalendarOptions(false)}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center z-[999] p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white/95 backdrop-blur-2xl rounded-[24px] border border-white/60 p-6 md:p-8 max-w-sm w-full shadow-2xl animate-fade-in flex flex-col gap-4 text-center"
            >
              <h3 className="text-xl font-extrabold text-slate-800">Add to Calendar</h3>
              <p className="text-xs text-slate-500">
                Choose your calendar app.
              </p>
              
              <div className="flex flex-col gap-2 mt-2">
                <a
                  href={googleCalendarUrl!}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-200 transition-colors"
                >
                  Google Calendar
                </a>
                <a
                  href={icsUrl}
                  className="py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-200 transition-colors"
                >
                  Apple Calendar (ICS)
                </a>
                <a
                  href={icsUrl}
                  className="py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-200 transition-colors"
                >
                  Outlook (ICS)
                </a>
                <a
                  href={icsUrl}
                  className="py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-200 transition-colors"
                >
                  Download ICS file
                </a>
              </div>
              
              <button
                type="button"
                onClick={() => setShowCalendarOptions(false)}
                className="mt-2 py-2 px-4 bg-white hover:bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider rounded-full border border-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
