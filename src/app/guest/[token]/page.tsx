"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import { useParams } from "next/navigation";
import { Sparkles, Calendar, Send, Heart, Users, MessageSquare, Clock, Maximize } from "lucide-react";

type Prediction = "boy" | "girl" | null;

const BabyBoySvg = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="32" fill="#FFE5D9" stroke="#E5C3B3" strokeWidth="2"/>
    <circle cx="38" cy="45" r="3" fill="#333"/>
    <circle cx="62" cy="45" r="3" fill="#333"/>
    <path d="M35 39 C 38 37, 41 39, 41 39" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M65 39 C 62 37, 59 39, 59 39" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="32" cy="53" r="5" fill="#FFB3B3" opacity="0.6"/>
    <circle cx="68" cy="53" r="5" fill="#FFB3B3" opacity="0.6"/>
    <circle cx="50" cy="58" r="9" fill="#3A9FE8"/>
    <circle cx="50" cy="58" r="5" fill="#90CDF4"/>
    <circle cx="50" cy="68" r="6" stroke="#3A9FE8" strokeWidth="2.5" fill="none"/>
    <path d="M20 40 C 20 20, 80 20, 80 40 Z" fill="#3A9FE8"/>
    <circle cx="50" cy="18" r="6" fill="#90CDF4"/>
    <rect x="18" y="36" width="64" height="6" rx="3" fill="#90CDF4"/>
  </svg>
);

const BabyGirlSvg = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="32" fill="#FFE5D9" stroke="#E5C3B3" strokeWidth="2"/>
    <circle cx="38" cy="45" r="3" fill="#333"/>
    <circle cx="62" cy="45" r="3" fill="#333"/>
    <path d="M35 39 C 38 37, 41 39, 41 39" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M65 39 C 62 37, 59 39, 59 39" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="32" cy="53" r="5" fill="#FFB3B3" opacity="0.6"/>
    <circle cx="68" cy="53" r="5" fill="#FFB3B3" opacity="0.6"/>
    <circle cx="50" cy="58" r="9" fill="#E8449A"/>
    <circle cx="50" cy="58" r="5" fill="#FBB6CE"/>
    <circle cx="50" cy="68" r="6" stroke="#E8449A" strokeWidth="2.5" fill="none"/>
    <path d="M26 24 C 20 20, 20 36, 32 30 Z" fill="#E8449A"/>
    <path d="M38 24 C 44 20, 44 36, 32 30 Z" fill="#E8449A"/>
    <circle cx="32" cy="29" r="4.5" fill="#FFF"/>
  </svg>
);

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
  const iframeContainerRef = useRef<HTMLDivElement | null>(null);

  const toggleFullscreen = () => {
    if (!iframeContainerRef.current) return;
    if (!document.fullscreenElement) {
      iframeContainerRef.current.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [prediction, setPrediction] = useState<Prediction>(null);
  const [message, setMessage] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const [votes, setVotes] = useState<{ boy: number; girl: number; total: number }>({ boy: 0, girl: 0, total: 0 });

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadInvite = useCallback(async () => {
    let bid = localStorage.getItem("vgr_browser_id");
    if (!bid) {
      bid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("vgr_browser_id", bid);
    }
    const res = await fetch(`/api/guest/${encodedToken}?browserId=${bid}`);
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

    if (data?.votes) {
      setVotes(data.votes);
    }

    if (data?.response?.prediction === "boy" || data?.response?.prediction === "girl") {
      setPrediction(data.response.prediction);
      setMessage(data?.response?.message || "");
      setDone(true);
      if (data?.reveal?.id) {
        localStorage.setItem(`vgr_prediction_${data.reveal.id}`, data.response.prediction);
      }
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
    }, 3000);
    return () => clearInterval(refresh);
  }, [encodedToken, loadInvite]);

  // Read local storage on token change/load
  useEffect(() => {
    if (!encodedToken) return;
    try {
      const parts = decodeURIComponent(encodedToken).split(".");
      if (parts[0]) {
        const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
        if (payload?.enquiryId) {
          const localVote = localStorage.getItem(`vgr_prediction_${payload.enquiryId}`);
          if (localVote === "boy" || localVote === "girl") {
            setPrediction(localVote as "boy" | "girl");
            setDone(true);
          }
        }
      }
    } catch (e) {
      console.error("Local storage lookup failed on mount:", e);
    }
  }, [encodedToken]);

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

  const streamEmbedUrl = useMemo(() => {
    if (!videoUrl) return "";
    
    let uid = "";
    const parts = videoUrl.split("/");
    for (const part of parts) {
      const cleaned = part.replace(/\?.*/, "");
      if (cleaned.length === 32 || cleaned.length === 36) {
        uid = cleaned;
        break;
      }
    }
    
    if (!uid) return videoUrl;
    
    let startTime = 0;
    if (revealAtIso) {
      const revealTime = new Date(revealAtIso).getTime();
      const diffSeconds = Math.floor((Date.now() - revealTime) / 1000);
      startTime = Math.max(0, diffSeconds);
    }
    
    return `https://iframe.videodelivery.net/${uid}?autoplay=true&controls=false&muted=true&startTime=${startTime}`;
  }, [videoUrl, revealAtIso]);

  function getFormattedDateOnly(isoString: string | null, timezone: string): string {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: timezone,
      });
    } catch {
      return "";
    }
  }

  function getFormattedTimeOnly(isoString: string | null, timezone: string): string {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      const timeStr = d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone,
      });
      let tzAbbr = "";
      try {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          timeZoneName: "short",
        }).formatToParts(d);
        const tzPart = parts.find(p => p.type === "timeZoneName");
        tzAbbr = tzPart ? tzPart.value : "";
      } catch {}
      return tzAbbr ? `${timeStr} (${tzAbbr})` : timeStr;
    } catch {
      return "";
    }
  }

  const boyVotes = votes?.boy || 0;
  const girlVotes = votes?.girl || 0;
  const totalVotes = votes?.total || 0;
  const boyPct = totalVotes > 0 ? Math.round((boyVotes / totalVotes) * 100) : 50;
  const girlPct = totalVotes > 0 ? 100 - boyPct : 50;
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

  async function submitVote(gender: "boy" | "girl") {
    if (submitting) return;
    setPrediction(gender);
    setSubmitting(true);
    setError(null);
    let bid = localStorage.getItem("vgr_browser_id");
    if (!bid) {
      bid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("vgr_browser_id", bid);
    }
    const res = await fetch(`/api/guest/${encodedToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prediction: gender, message: "", browserId: bid }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "Failed to save your vote.");
      setPrediction(null);
      setSubmitting(false);
      return;
    }
    setDone(true);
    setSubmitting(false);
    await loadInvite();
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

  async function sendQuickMessage(text: string) {
    if (chatSending || isCompleted) return;
    setChatSending(true);
    setChatError(null);
    const res = await fetch(`/api/guest/${encodedToken}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setChatError(data?.error || "Could not send that message.");
    }
    setChatSending(false);
  }

  return (
    <>
      <style>{`
        .party-bg-video {
          will-change: transform;
          object-fit: fill;
        }
        @media (prefers-reduced-motion: reduce) {
          .party-bg-video {
            display: none !important;
          }
        }
        @keyframes float-heart {
          0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.8; }
          100% { transform: translateY(-120px) scale(1.1) rotate(15deg); opacity: 0; }
        }
        @keyframes float-star {
          0% { transform: translateY(0) scale(0.8) rotate(0deg); opacity: 0; }
          10% { opacity: 0.7; }
          90% { opacity: 0.7; }
          100% { transform: translateY(-100px) scale(1) rotate(-15deg); opacity: 0; }
        }
        @keyframes bounce-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes blink-colon {
          0%, 100% { opacity: 1; filter: drop-shadow(0 0 6px rgba(255,255,255,0.8)); }
          50% { opacity: 0.2; filter: none; }
        }
        @keyframes glow-pulse-blue {
          0%, 100% { box-shadow: 0 0 10px rgba(58,159,232,0.15), inset 0 0 10px rgba(255,255,255,0.4); }
          50% { box-shadow: 0 0 22px rgba(58,159,232,0.4), inset 0 0 16px rgba(58,159,232,0.2); }
        }
        @keyframes glow-pulse-pink {
          0%, 100% { box-shadow: 0 0 10px rgba(232,68,154,0.15), inset 0 0 10px rgba(255,255,255,0.4); }
          50% { box-shadow: 0 0 22px rgba(232,68,154,0.4), inset 0 0 16px rgba(232,68,154,0.2); }
        }
        @keyframes glow-pulse-purple {
          0%, 100% { box-shadow: 0 0 10px rgba(123,110,232,0.15), inset 0 0 10px rgba(255,255,255,0.4); }
          50% { box-shadow: 0 0 22px rgba(123,110,232,0.4), inset 0 0 16px rgba(123,110,232,0.2); }
        }
        @keyframes glow-pulse-gold {
          0%, 100% { box-shadow: 0 0 10px rgba(245,158,11,0.15), inset 0 0 10px rgba(255,255,255,0.4); }
          50% { box-shadow: 0 0 22px rgba(245,158,11,0.45), inset 0 0 16px rgba(245,158,11,0.2); }
        }
        .anim-float-heart-1 { animation: float-heart 6s ease-in-out infinite; }
        .anim-float-heart-2 { animation: float-heart 8s ease-in-out infinite; animation-delay: 2s; }
        .anim-float-star-1 { animation: float-star 5s ease-in-out infinite; animation-delay: 1s; }
        .anim-float-star-2 { animation: float-star 7s ease-in-out infinite; animation-delay: 3s; }
        
        .embossed-num {
          text-shadow: 1px 1px 0px rgba(255,255,255,0.8), -1px -1px 0px rgba(0,0,0,0.06), 0px 4px 10px rgba(0,0,0,0.08);
          animation: bounce-gentle 2s ease-in-out infinite alternate;
        }
        .party-header-new {
          background-image: url('/assets/party-page-header.png');
          background-size: 100% 100%;
          background-position: center;
          background-repeat: no-repeat;
          padding: 3vw 24% 3vw 24%;
          min-height: 25vw;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.35vw;
        }
        @media (max-width: 1024px) {
          .party-header-new {
            padding: 3vw 15% 3vw 15%;
            min-height: auto;
          }
        }
        @media (max-width: 768px) {
          .party-header-new {
            background-image: url('/assets/party-page-banner-mobile.png');
            padding: 2.5rem 1.2rem;
            background-size: cover;
            min-height: auto;
            gap: 0.75rem;
          }
        }
      `}</style>

      <div className="relative min-h-screen overflow-x-hidden w-full font-sans antialiased text-[#1f2937] bg-gradient-to-tr from-[#E8449A]/10 via-white/80 to-[#3A9FE8]/10">
        {/* Decorative Fixed Video Background (Desktop only) */}
        <video
          src="/videos/party-page-background.mp4"
          autoPlay
          loop
          muted
          playsInline
          controls={false}
          aria-hidden="true"
          className="party-bg-video hidden md:block fixed inset-0 w-full h-full object-fill z-0 pointer-events-none"
        />
        
        {/* Decorative Fixed Image Background (Mobile only) */}
        <img
          src="/images/party_page_mobile.jpeg"
          alt="Party Background Mobile"
          className="block md:hidden fixed inset-0 w-full h-full object-cover z-0 pointer-events-none"
        />
        
        {/* Main Content (z-index 20) */}
        <div className="relative z-20 max-w-[1080px] mx-auto px-4 py-8 md:py-12 flex flex-col gap-6">
          {/* 1. PARTY HERO HEADER (Custom Illustrated Banner Background) */}
          <header className="party-header-new relative overflow-hidden text-center w-full border border-white/20 shadow-2xl rounded-[24px]">
            {/* Home Navigation Button */}
            <div className="absolute top-4 left-4 z-30">
              <a
                href="/"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/40 hover:bg-white/60 backdrop-blur-md border border-white/40 rounded-xl text-[10px] md:text-xs font-black text-slate-800 transition-all hover:scale-105 active:scale-95 shadow-sm"
              >
                🏠 Home
              </a>
            </div>

            {/* Welcome Banner Text Layout */}
            <div className="flex items-center justify-center gap-1 text-[10px] md:text-xs font-black text-[#1b4f8c] tracking-widest uppercase leading-none">
              <span className="text-[#E8449A] text-xs">💗</span> WELCOME {guestName.toUpperCase()} TO <span className="text-[#3A9FE8] text-xs">💙</span>
            </div>

            <h1 className="font-playfair font-semibold text-2xl md:text-5xl leading-tight select-none mt-1">
              {(() => {
                const parts = parentName.split(/(\s*&\s*|\s+and\s+)/i);
                return parts.map((part, idx) => {
                  if (part.trim() === "&" || part.trim().toLowerCase() === "and") {
                    return <span key={idx} className="text-[#e2b857]"> & </span>;
                  }
                  return <span key={part + idx} className="text-[#1B4F8C]">{part}</span>;
                });
              })()}&apos;s
            </h1>

            <div className="flex items-center justify-center gap-1.5 font-black text-xs md:text-lg text-[#3A9FE8] tracking-[0.18em] uppercase leading-none mt-0.5">
              <span className="text-[#e2b857] text-[10px] md:text-xs">✦</span>
              <span className="bg-gradient-to-r from-[#3A9FE8] via-[#E8449A] to-[#3A9FE8] bg-clip-text text-transparent">VIRTUAL GENDER REVEAL</span>
              <span className="text-[#e2b857] text-[10px] md:text-xs">✦</span>
            </div>

            <div className="flex items-center justify-center gap-2.5 mt-1 opacity-90 select-none">
              <span className="w-8 md:w-12 h-[1px] bg-slate-300" />
              <span className="text-[#E8449A] text-xs md:text-sm">💗</span>
              <span className="w-8 md:w-12 h-[1px] bg-slate-300" />
            </div>

            <p className="text-[10px] md:text-xs text-slate-700 font-semibold italic mt-1 leading-tight">
              Thank you for being part of
              <br />
              our baby&apos;s big day.
            </p>

            {googleCalendarUrl && (
              <div className="flex justify-center mt-1.5">
                <button
                  type="button"
                  onClick={() => setShowCalendarOptions(true)}
                  className="flex items-center gap-1 text-[10px] md:text-xs font-bold text-slate-800 hover:text-[#E8449A] transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#3A9FE8]" />
                  Add to Calendar
                </button>
              </div>
            )}
          </header>

          {/* 2. REVEAL VIDEO / COUNTDOWN AREA (Centered Glassmorphic Video Box - Full Width) */}
          <section className={`relative overflow-hidden transition-all duration-300 w-full ${isLive && videoUrl ? "bg-slate-950/20 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[24px]" : "bg-white/45 backdrop-blur-[30px] border border-white/50 border-[1.5px] rounded-[32px] py-4 px-5 md:py-5 md:px-8 shadow-2xl flex flex-col items-center justify-center"}`}>
            {/* Ambient subtle celebratory pink/blue glows in the corners */}
            <div className="absolute top-0 left-0 w-48 h-48 bg-[#E8449A]/15 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#3A9FE8]/15 blur-3xl pointer-events-none" />

            {!isLive && (
              <>
                {/* Floating hearts/stars decorative particles */}
                <div className="absolute top-1/4 left-10 text-xl opacity-30 pointer-events-none anim-float-heart-1">💖</div>
                <div className="absolute top-1/3 right-12 text-lg opacity-25 pointer-events-none anim-float-star-1">⭐</div>
                <div className="absolute bottom-1/4 left-16 text-lg opacity-25 pointer-events-none anim-float-star-2">✨</div>
                <div className="absolute bottom-1/3 right-16 text-xl opacity-30 pointer-events-none anim-float-heart-2">💕</div>
              </>
            )}

            <div ref={iframeContainerRef} className={`relative w-full ${isLive && videoUrl ? "aspect-video bg-slate-950/40" : "w-full flex flex-col items-center justify-center bg-transparent mt-1 mb-1"}`}>
              {isLive && videoUrl ? (
                <>
                  <iframe
                    src={streamEmbedUrl}
                    title="Reveal Video"
                    className="w-full h-full border-0"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                    allowFullScreen
                  />
                  {/* Floating Custom Fullscreen Button */}
                  <div className="absolute right-4 bottom-4 z-30">
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      className="px-3 py-1.5 bg-slate-950/85 hover:bg-slate-950 backdrop-blur-md rounded-xl border border-white/20 text-white shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-black"
                      title="Toggle Fullscreen"
                    >
                      <Maximize className="w-3.5 h-3.5 text-[#3A9FE8]" />
                      Fullscreen
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-0 bg-transparent z-10 relative">
                  <div className="flex flex-col items-center gap-1.5 w-full">
                    
                    <h2 className="text-lg md:text-xl font-nunito font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] tracking-wider flex items-center justify-center gap-1.5 drop-shadow-sm">
                      ✨ 👶🏼 THE BIG REVEAL IN 👶🏾 ✨
                    </h2>
                    
                    <p className="text-[11px] md:text-xs text-slate-500 font-bold italic text-center mt-0.5">
                      🧸 Every second brings you closer to meeting your little miracle. 🍼
                    </p>

                    <div className="w-full flex items-center justify-center mt-4 w-full max-w-[620px]">
                      <div className="relative w-full aspect-[3/2] bg-[url('/images/countdown-cards.png')] bg-contain bg-no-repeat bg-center select-none overflow-hidden @container">
                        
                        {/* Days Number */}
                        <div
                          className="absolute flex items-center justify-center text-[#2a80ea] font-extrabold tracking-tighter text-center"
                          style={{
                            left: '9.8%',
                            top: '28%',
                            width: '18.7%',
                            height: '33%',
                            fontSize: 'clamp(24px, 8.5cqw, 82px)',
                            textShadow: '1px 1px 0px rgba(255,255,255,0.8), -1px -1px 0px rgba(0,0,0,0.06), 0px 4px 10px rgba(0,0,0,0.08)',
                            animation: 'bounce-gentle 2s ease-in-out infinite alternate',
                          }}
                        >
                          {String(countdownParts.d).padStart(2, "0")}
                        </div>

                        {/* Hours Number */}
                        <div
                          className="absolute flex items-center justify-center text-[#ea3998] font-extrabold tracking-tighter text-center"
                          style={{
                            left: '30.5%',
                            top: '28%',
                            width: '18.7%',
                            height: '33%',
                            fontSize: 'clamp(24px, 8.5cqw, 82px)',
                            textShadow: '1px 1px 0px rgba(255,255,255,0.8), -1px -1px 0px rgba(0,0,0,0.06), 0px 4px 10px rgba(0,0,0,0.08)',
                            animation: 'bounce-gentle 2s ease-in-out infinite alternate',
                            animationDelay: '0.2s',
                          }}
                        >
                          {String(countdownParts.h).padStart(2, "0")}
                        </div>

                        {/* Minutes Number */}
                        <div
                          className="absolute flex items-center justify-center text-[#7c56ed] font-extrabold tracking-tighter text-center"
                          style={{
                            left: '51%',
                            top: '28%',
                            width: '18.7%',
                            height: '33%',
                            fontSize: 'clamp(24px, 8.5cqw, 82px)',
                            textShadow: '1px 1px 0px rgba(255,255,255,0.8), -1px -1px 0px rgba(0,0,0,0.06), 0px 4px 10px rgba(0,0,0,0.08)',
                            animation: 'bounce-gentle 2s ease-in-out infinite alternate',
                            animationDelay: '0.4s',
                          }}
                        >
                          {String(countdownParts.m).padStart(2, "0")}
                        </div>

                        {/* Seconds Number */}
                        <div
                          className="absolute flex items-center justify-center text-[#f59700] font-extrabold tracking-tighter text-center"
                          style={{
                            left: '71.5%',
                            top: '28%',
                            width: '18.7%',
                            height: '33%',
                            fontSize: 'clamp(24px, 8.5cqw, 82px)',
                            textShadow: '1px 1px 0px rgba(255,255,255,0.8), -1px -1px 0px rgba(0,0,0,0.06), 0px 4px 10px rgba(0,0,0,0.08)',
                            animation: 'bounce-gentle 2s ease-in-out infinite alternate',
                            animationDelay: '0.6s',
                      }}
                    >
                          {String(countdownParts.s).padStart(2, "0")}
                        </div>

                        {/* Pill Content Overlay */}
                        <div
                          className="absolute flex items-center justify-center gap-1.5 md:gap-3 text-[#5E5B8E] font-bold select-none text-center"
                          style={{
                            left: '20%',
                            top: '78%',
                            width: '60%',
                            height: '10%',
                          }}
                        >
                          {/* Date slot */}
                          <div className="flex items-center gap-1.5 truncate" style={{ fontSize: 'clamp(9px, 1.8cqw, 15px)' }}>
                            <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 text-[#E8449A] shrink-0" />
                            <span>{getFormattedDateOnly(revealAtIso, revealTimezone)}</span>
                          </div>
                          
                          <span className="text-[#5E5B8E]/30 text-xs md:text-sm font-light">|</span>
                          
                          {/* Time slot */}
                          <div className="flex items-center gap-1.5 truncate" style={{ fontSize: 'clamp(9px, 1.8cqw, 15px)' }}>
                            <Clock className="w-3 h-3 md:w-3.5 md:h-3.5 text-[#E8449A] shrink-0" />
                            <span>{getFormattedTimeOnly(revealAtIso, revealTimezone)}</span>
                          </div>
                        </div>

                      </div>
                    </div>

                    <p className="mt-4 text-[11px] md:text-xs text-slate-500 font-semibold max-w-sm text-center leading-relaxed">
                      {countdownParts.live 
                        ? "We are live! The reveal stream is starting now." 
                        : "The screen will unlock automatically at the scheduled reveal time. Stay tuned!"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {!isLive && (
              <div className="absolute left-4 bottom-4 flex items-center gap-2 bg-white/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/80 text-[10px] font-black text-slate-800 shadow-md">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                🎈 Party Begins Soon
              </div>
            )}
          </section>
                {/* Row 3: Predictions / Voting (Full Width Glassmorphic Card) */}
          <div className="grid grid-cols-1 gap-6 w-full items-stretch animate-fade-in">
            {/* Box 3A: Prediction / Voting Form */}
            <section className="bg-white/15 backdrop-blur-xl border border-white/25 shadow-2xl rounded-[24px] p-6 flex flex-col justify-between gap-4 w-full">
              <div className="flex flex-col gap-4 w-full">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center border border-pink-400/20">
                    <Sparkles className="w-4.5 h-4.5 text-[#E8449A]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Cast Your Vote: Boy or Girl?</h2>
                  </div>
                </div>

                {/* Real-time Vote Percentages (Always visible for engagement!) */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-sm mt-1 mb-2">
                  <div className="flex justify-between items-center text-xs font-black text-slate-800 mb-2">
                    <span className="flex items-center gap-1">💙 Team Boy: {boyPct}% ({boyVotes} {boyVotes === 1 ? "vote" : "votes"})</span>
                    <span className="flex items-center gap-1">🩷 Team Girl: {girlPct}% ({girlVotes} {girlVotes === 1 ? "vote" : "votes"})</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-200/50 overflow-hidden flex">
                    <div
                      className="h-full bg-gradient-to-r from-[#3A9FE8] to-[#60A5FA] transition-all duration-500"
                      style={{ width: `${boyPct}%` }}
                    />
                    <div
                      className="h-full bg-gradient-to-r from-[#F472B6] to-[#E8449A] transition-all duration-500"
                      style={{ width: `${girlPct}%` }}
                    />
                  </div>
                </div>

                {loading ? (
                  <p className="text-sm text-slate-700 font-medium">Loading details…</p>
                ) : isCompleted ? (
                  <div className="bg-white/10 border border-white/20 rounded-2xl p-4 text-center">
                    <p className="text-sm text-slate-800 font-bold">This reveal event has completed. Thanks for joining 💛</p>
                  </div>
                ) : done ? (
                  <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-2xl p-4 text-center flex flex-col gap-2 shadow-sm items-center justify-center">
                    <p className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                      <span>✓</span> Response saved! Thanks for voting!
                    </p>
                    <div className="text-sm text-emerald-900 mt-1">
                      Your Prediction: <strong className={`font-black px-3 py-0.5 rounded-full text-xs text-white ${prediction === "boy" ? "bg-[#3A9FE8]" : "bg-[#E8449A]"}`}>
                        {prediction === "boy" ? "Team Boy 💙" : "Team Girl 🩷"}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-slate-700 font-bold text-center -mb-2">
                      Please vote for boy or girl below to submit your prediction:
                    </p>
                    
                    <div className="flex justify-center gap-10 md:gap-16 py-4">
                      {/* Vote Boy Button */}
                      <button
                        type="button"
                        onClick={() => submitVote("boy")}
                        disabled={submitting}
                        className="group flex flex-col items-center gap-3 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer focus:outline-none"
                      >
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#D6EAFE] to-[#BFDBFE] border border-[#3A9FE8]/40 shadow-md group-hover:shadow-lg group-hover:border-[#3A9FE8]/85 transition-all flex items-center justify-center p-3">
                          <BabyBoySvg className="w-full h-full transform group-hover:rotate-6 transition-transform" />
                        </div>
                        <span className="text-xs font-black text-[#1E40AF] tracking-wider uppercase bg-[#D6EAFE] px-3 py-1 rounded-full border border-[#3A9FE8]/25 shadow-sm">
                          Team Boy 💙
                        </span>
                      </button>

                      {/* Vote Girl Button */}
                      <button
                        type="button"
                        onClick={() => submitVote("girl")}
                        disabled={submitting}
                        className="group flex flex-col items-center gap-3 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer focus:outline-none"
                      >
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#FCE7F3] to-[#FBCFE8] border border-[#E8449A]/40 shadow-md group-hover:shadow-lg group-hover:border-[#E8449A]/85 transition-all flex items-center justify-center p-3">
                          <BabyGirlSvg className="w-full h-full transform group-hover:-rotate-6 transition-transform" />
                        </div>
                        <span className="text-xs font-black text-[#9D174D] tracking-wider uppercase bg-[#FCE7F3] px-3 py-1 rounded-full border border-[#E8449A]/25 shadow-sm">
                          Team Girl 🩷
                        </span>
                      </button>
                    </div>
                  </>
                )}
                {error && <p className="text-xs text-red-500 font-bold mt-1 text-center">⚠️ {error}</p>}
              </div>
            </section>

            {/* Box 3B: Guest Wishes (Code fully preserved but hidden as requested) */}
            {false && (
              <section className="bg-white/15 backdrop-blur-xl border border-white/25 shadow-2xl rounded-[24px] p-6 flex flex-col justify-between gap-4 w-full">
                <div className="flex flex-col gap-4 w-full">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-400/20">
                      <Heart className="w-4.5 h-4.5 text-[#3A9FE8] fill-[#3A9FE8]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">Guest wishes</h2>
                      <p className="text-xs text-slate-700 font-medium">Prediction messages saved.</p>
                    </div>
                  </div>

                  {feed.length === 0 ? (
                    <p className="text-sm text-slate-600 italic text-center py-8 font-semibold">No guest wishes yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                      {feed.map((item, idx) => (
                        <div
                          key={`${item.name}-${idx}`}
                          className="bg-white/25 border border-white/35 p-3 rounded-xl shadow-sm text-slate-900"
                        >
                          <span className="font-black text-xs text-slate-950 block mb-1">{item.name}</span>
                          <p className="text-xs text-slate-800 leading-normal italic font-medium">&ldquo;{item.message}&rdquo;</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Row 4: Live Chat & Who's Invited (Two equal-sized boxes side-by-side) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full items-stretch">
            {/* Box 4A: Live Party Chat (Glassmorphic White) */}
            <section className="bg-white/15 backdrop-blur-xl border border-white/25 shadow-2xl rounded-[24px] p-5 flex flex-col justify-between gap-3 text-slate-800 w-full">
              <div className="flex flex-col gap-3 w-full">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4.5 h-4.5 text-[#E8449A]" />
                    <h3 className="text-base font-black text-slate-900">Live chat</h3>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      chatStatus === "live"
                        ? "bg-emerald-500/20 text-emerald-850 border border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-850 border border-amber-500/30"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${chatStatus === "live" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                    {chatStatus === "live" ? "Live" : chatStatus === "connecting" ? "Connecting" : "Reconnecting"}
                  </span>
                </div>

                {/* Translucent Chat Feed */}
                <div className="h-[200px] overflow-y-auto pr-1 flex flex-col gap-2.5 mt-1 bg-white/10 rounded-2xl p-3 border border-white/10">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                      No chat messages yet.
                    </div>
                  ) : (
                    chatMessages.map((item) => (
                      <div key={item.id} className="text-xs bg-white/25 border border-white/35 p-2.5 rounded-xl shadow-sm text-slate-900">
                        <div className="flex justify-between items-center gap-2">
                          <strong className="text-[#c2527a] font-black">{item.name}</strong>
                          <span className="text-[10px] text-slate-500 font-medium">{formatChatTime(item.createdAtIso)}</span>
                        </div>
                        <p className="text-slate-800 mt-1 leading-relaxed overflow-wrap-anywhere font-medium">{item.message}</p>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* One-click Chat Messages */}
              {!isCompleted && (
                <div className="flex flex-wrap gap-1.5 mt-2 mb-1 justify-start">
                  {[
                    { text: "🎉 Congratulations!", label: "🎉 Congrats!" },
                    { text: "💙 Team Boy!", label: "💙 Team Boy!" },
                    { text: "🩷 Team Girl!", label: "🩷 Team Girl!" }
                  ].map((quick) => (
                    <button
                      key={quick.text}
                      type="button"
                      onClick={() => sendQuickMessage(quick.text)}
                      disabled={chatSending}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-white/40 bg-white/20 hover:bg-white/40 text-slate-800 transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {quick.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Message Input Form */}
              <div className="relative w-full mt-1">
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-0 mb-2 w-full bg-white/70 backdrop-blur-md border border-white/40 p-2 rounded-xl shadow-xl z-30 flex flex-wrap gap-1.5 justify-center animate-fade-in">
                    {["👶", "🍼", "💙", "🩷", "🎉", "🥳", "✨", "🧸", "👣", "🎈"].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setChatText((prev) => prev + emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="w-7 h-7 flex items-center justify-center hover:bg-white/90 hover:scale-110 rounded-lg text-base transition-all active:scale-95 cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                <form onSubmit={submitChat} className="flex gap-1.5 w-full items-center">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    disabled={isCompleted}
                    className="h-9 w-9 flex items-center justify-center bg-white/20 hover:bg-white/45 active:scale-95 text-slate-800 hover:text-slate-900 border border-white/35 rounded-xl transition-all shrink-0 cursor-pointer text-sm"
                    title="Add celebratory emoji"
                  >
                    😊
                  </button>
                  <input
                    type="text"
                    value={chatText}
                    maxLength={500}
                    onChange={(e) => setChatText(e.target.value)}
                    disabled={isCompleted}
                    placeholder={isCompleted ? "Chat is closed" : "Say something..."}
                    className="flex-1 text-xs rounded-xl border border-white/30 px-3 py-2 bg-white/25 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E8449A]/30 focus:border-[#E8449A] transition-all disabled:bg-white/5 font-semibold h-9"
                  />
                  <button
                    type="submit"
                    disabled={!chatText.trim() || chatSending || isCompleted}
                    className="px-4 py-2 bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] hover:from-[#d13787] hover:to-[#2e8fd1] disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all duration-200 flex items-center justify-center shrink-0 cursor-pointer h-9"
                  >
                    {chatSending ? "..." : "Send"}
                  </button>
                </form>
              </div>
              {chatError && <p className="text-[10px] text-red-500 font-bold mt-1">⚠️ {chatError}</p>}
            </section>

            {/* Box 4B: Who's Invited (Glassmorphic) */}
            <section className="bg-white/15 backdrop-blur-xl border border-white/25 shadow-2xl rounded-[24px] p-5 flex flex-col justify-between gap-3 w-full">
              <div className="flex flex-col gap-3 w-full">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
                  <Users className="w-4.5 h-4.5 text-[#3A9FE8]" />
                  <h3 className="text-base font-black text-slate-900">Who&apos;s invited</h3>
                </div>
                <p className="text-xs text-slate-700 font-medium">Guest list for this reveal.</p>
                {invitedGuests.length === 0 ? (
                  <p className="text-xs text-slate-600 italic font-semibold">No guest names available yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-1 max-h-[200px] overflow-y-auto pr-1">
                    {invitedGuests.map((guest, idx) => (
                      <span
                        key={`${guest.name}-${idx}`}
                        className="text-xs font-black px-2.5 py-1 rounded-full bg-white/30 backdrop-blur-sm border border-white/40 text-slate-800 shadow-sm"
                      >
                        {guest.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>
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
