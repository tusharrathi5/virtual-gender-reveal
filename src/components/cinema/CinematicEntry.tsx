"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const SCENE_DURATIONS = [3800, 3200, 3200, 4000, 4500, 0];
const SITE_LOGO_SRC = "/Logo%201.png";
const FALLBACK_LOGO_SRC = "/Favicon-VGR.png";

function SiteLogo({ className }: { className: string }) {
  return (
    <img
      src={SITE_LOGO_SRC}
      alt="Virtual Gender Reveal logo"
      className={className}
      onError={(event) => {
        if (event.currentTarget.src.endsWith(FALLBACK_LOGO_SRC)) return;
        event.currentTarget.src = FALLBACK_LOGO_SRC;
      }}
    />
  );
}

const INTRO_KEY = "vgr_intro_seen";
const INTRO_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

// ✅ Use localStorage with 24hr TTL so intro only plays once per day
// sessionStorage clears on navigation — localStorage persists across pages
function hasSeenIntro(): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(INTRO_KEY);
  if (!raw) return false;
  const ts = parseInt(raw, 10);
  if (Date.now() - ts > INTRO_TTL) {
    localStorage.removeItem(INTRO_KEY); // expired — show intro again
    return false;
  }
  return true;
}
function markIntroSeen() {
  if (typeof window !== "undefined") localStorage.setItem(INTRO_KEY, Date.now().toString());
}

const CLOUDS_S1 = [
  { w: 260, h: 90, top: "12%", left: "5%", blur: "28px" },
  { w: 180, h: 70, top: "18%", left: "62%", blur: "22px" },
  { w: 320, h: 100, top: "28%", left: "35%", blur: "35px" },
  { w: 140, h: 55, top: "8%", left: "80%", blur: "18px" },
  { w: 200, h: 75, top: "38%", left: "15%", blur: "25px" },
];

const CONFETTI_PIECES = Array.from({ length: 22 }, (_, i) => ({
  left: `${Math.random() * 100}%`,
  color: i % 2 === 0 ? "#82B8E8" : "#F2B8CF",
  dur: `${1.5 + Math.random() * 1.5}s`,
  del: `${Math.random() * 2}s`,
  size: 5 + Math.random() * 8,
}));

export default function CinematicEntry() {
  // ✅ Check localStorage on first render — skip intro if seen in last 24hrs
  const [scene, setScene] = useState<number>(6);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const hasSeenIntro = sessionStorage.getItem("vgr-cinematic-seen");
    if (hasSeenIntro === "true") {
      setScene(6);
    }
  }, []);

  const advance = () => {
    if (scene + 1 >= 6) {
      sessionStorage.setItem("vgr-cinematic-seen", "true");
      setExiting(true);
      setTimeout(() => setScene(6), 700);
    } else {
      setScene(s => s + 1);
    }
  };

  function skipIntro() {
    markIntroSeen();
    setExiting(true);
    setTimeout(() => setScene(6), 600);
  }

  useEffect(() => {
    if (scene >= 6) return;
    const dur = SCENE_DURATIONS[scene];
    if (dur === 0) return;
    timerRef.current = setTimeout(advance, dur);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [scene]);

  useEffect(() => {
    if (scene !== 6) return;
    const timer = setTimeout(() => {
      const obs = new IntersectionObserver(
        entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }),
        { threshold: 0.12 }
      );
      document.querySelectorAll(".fade-up").forEach(el => obs.observe(el));
      return () => obs.disconnect();
    }, 200);
    return () => clearTimeout(timer);
  }, [scene]);

  useEffect(() => {
    if (scene !== 6) return;
    const onScroll = () => {
      const nav = document.getElementById("main-nav");
      if (nav) nav.classList.toggle("solid", window.scrollY > 20);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [scene]);

  if (scene === 6) return <LandingPage />;


  return (
    <>
      <style>{CINEMA_CSS}</style>
      <div id="cinema" className={exiting ? "fade-out" : ""}>
        <button className="skip-btn" onClick={skipIntro}>Skip intro →</button>

        {scene === 0 && (
          <div className="scene active">
            <div className="s1-sky" />
            {CLOUDS_S1.map((c, i) => <div key={i} className="cloud" style={{ width: c.w, height: c.h, top: c.top, left: c.left, "--blur": c.blur } as React.CSSProperties} />)}
            <div className="bird-wrap">
              <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
                <ellipse cx="60" cy="52" rx="22" ry="12" fill="white" opacity="0.95" />
                <path d="M10 45 Q35 20 60 52 Q85 20 110 45" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
                <ellipse cx="60" cy="50" rx="8" ry="6" fill="rgba(130,184,232,0.4)" />
              </svg>
            </div>
            <div className="cin-text" style={{ marginTop: "60px" }}>
              <p>&ldquo;From a place far beyond…<br />a new journey begins.&rdquo;</p>
              <div className="dot-row">◆ &nbsp; ◆ &nbsp; ◆</div>
            </div>
            <SceneProgress current={scene} />
          </div>
        )}

        {scene === 1 && (
          <div className="scene active">
            <div className="s2-bg" />
            {[{ w: 200, h: 70, top: "8%", left: "5%" }, { w: 160, h: 60, top: "14%", left: "70%" }, { w: 240, h: 80, top: "22%", left: "38%" }].map((c, i) => (
              <div key={i} className="cloud" style={{ width: c.w, height: c.h, top: c.top, left: c.left, "--blur": "24px" } as React.CSSProperties} />
            ))}
            <div style={{ zIndex: 5, marginBottom: "1.5rem" }}>
              <svg width="140" height="90" viewBox="0 0 140 90" fill="none" style={{ filter: "drop-shadow(0 8px 24px rgba(0,80,180,0.25))", display: "block" }}>
                <ellipse cx="70" cy="62" rx="25" ry="13" fill="white" opacity="0.95" />
                <path d="M8 52 Q39 22 70 62 Q101 22 132 52" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ display: "flex", gap: "4rem", alignItems: "center", zIndex: 5, marginBottom: "1.5rem", animation: "bundleFloat 3s ease-in-out infinite alternate" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem" }}>
                <div className="bundle-orb bundle-blue">🔵</div><div className="bundle-label">Boy</div>
              </div>
              <div style={{ width: 2, height: 60, background: "linear-gradient(to bottom,transparent,rgba(255,255,255,0.4),transparent)" }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem" }}>
                <div className="bundle-orb bundle-pink">🩷</div><div className="bundle-label">Girl</div>
              </div>
            </div>
            <div className="cin-text"><p>&ldquo;Two possibilities.<br /><em>One beautiful destiny.</em>&rdquo;</p></div>
            <SceneProgress current={scene} />
          </div>
        )}

        {scene === 2 && (
          <div className="scene active">
            <div className="s3-bg" />
            {Array.from({ length: 14 }, (_, i) => <div key={i} className="arena-light" style={{ animationDelay: `${i * 0.2}s` }} />)}
            <div style={{ position: "relative", zIndex: 5, width: "90%", maxWidth: 700, animation: "fadeUp 0.8s ease 0.2s both" }}>
              <div style={{ textAlign: "center", marginBottom: "1rem" }}><span style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,220,150,0.6)" }}>⬡ Grand Reveal Arena ⬡</span></div>
              <div className="track-surface">
                <div className="track-lane" style={{ top: "30%" }} /><div className="track-lane" style={{ top: "70%" }} />
                <div className="horse-arrive">🐎 🔵 + 🩷</div>
              </div>
            </div>
            <div className="cin-text" style={{ marginTop: "1.5rem" }}><p><em>&ldquo;The stage is set. The arena awaits.&rdquo;</em></p></div>
            <SceneProgress current={scene} />
          </div>
        )}

        {scene === 3 && (
          <div className="scene active">
            <div className="s4-bg" /><div className="crowd-dots" />
            <div style={{ position: "relative", zIndex: 5, width: "92%", maxWidth: 760 }}>
              {[
                { cls: "lane-blue", label: "Team Boy", labelCls: "label-blue", stop: "58%", delay: "0.2s", emoji: "🔵", obstacles: [{ left: "35%", oa: "1.2s", icon: "🌊" }, { left: "60%", oa: "1.8s", icon: "⭐" }] },
                { cls: "lane-pink", label: "Team Girl", labelCls: "label-pink", stop: "52%", delay: "0.4s", emoji: "🩷", obstacles: [{ left: "28%", oa: "1s", icon: "🌸" }, { left: "55%", oa: "1.6s", icon: "💫" }] },
              ].map((lane, i) => (
                <div key={i} className={`race-lane ${lane.cls}`} style={{ marginBottom: i === 0 ? 8 : 0 }}>
                  <div className={`race-label ${lane.labelCls}`}>{lane.label}</div>
                  <div className="racer" style={{ "--stop": lane.stop, "--rd": lane.delay } as React.CSSProperties}>
                    <span style={{ fontSize: "2.2rem", animation: "horseGallop 0.3s linear infinite" }}>🐎</span>
                    <span style={{ fontSize: "1.2rem" }}>{lane.emoji}</span>
                  </div>
                  {lane.obstacles.map((o, j) => <div key={j} className="obstacle" style={{ left: o.left, "--oa": o.oa } as React.CSSProperties}>{o.icon}</div>)}
                </div>
              ))}
            </div>
            <div className="cin-text" style={{ marginTop: "1.5rem" }}>
              <p><em>The race has begun...</em></p>
              <div style={{ fontFamily: "Plus Jakarta Sans", fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 600, color: "var(--gold-light)", letterSpacing: "0.08em", marginTop: "0.4rem" }}>🏁 AND THEY&apos;RE OFF!</div>
            </div>
            <SceneProgress current={scene} />
          </div>
        )}

        {scene === 4 && (
          <div className="scene active" style={{ flexDirection: "row" }}>
            <div style={{ position: "absolute", inset: 0, display: "flex" }}>
              <div className="s5-half s5-blue" style={{ "--hs": "0.1s" } as React.CSSProperties}>
                <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
                  {CONFETTI_PIECES.filter((_, i) => i % 2 === 0).map((c, i) => (
                    <div key={i} className="confetto" style={{ left: c.left, background: c.color, "--cf-dur": c.dur, "--cf-del": c.del, width: c.size, height: c.size } as React.CSSProperties} />
                  ))}
                </div>
                <span style={{ fontSize: "clamp(2rem,5vw,4rem)", animation: "wordPop 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.6s both", display: "block" }}>👶</span>
                <div className="reveal-big" style={{ "--wp": "0.8s" } as React.CSSProperties}>It&apos;s a<br /><strong>Boy</strong></div>
                <div style={{ fontSize: "3rem", marginTop: "0.6rem", animation: "wordPop 0.6s ease 1.3s both", display: "block" }}>💙</div>
              </div>
              <div className="s5-divider" />
              <div className="s5-half s5-pink" style={{ "--hs": "0.25s" } as React.CSSProperties}>
                <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
                  {CONFETTI_PIECES.filter((_, i) => i % 2 !== 0).map((c, i) => (
                    <div key={i} className="confetto" style={{ left: c.left, background: c.color, "--cf-dur": c.dur, "--cf-del": c.del, width: c.size, height: c.size } as React.CSSProperties} />
                  ))}
                </div>
                <span style={{ fontSize: "clamp(2rem,5vw,4rem)", animation: "wordPop 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.7s both", display: "block" }}>👶</span>
                <div className="reveal-big" style={{ "--wp": "1s" } as React.CSSProperties}>It&apos;s a<br /><strong>Girl</strong></div>
                <div style={{ fontSize: "3rem", marginTop: "0.6rem", animation: "wordPop 0.6s ease 1.5s both", display: "block" }}>🩷</div>
              </div>
            </div>
            <SceneProgress current={scene} />
          </div>
        )}

        {scene === 5 && (
          <div className="scene active">
            <div className="s1-sky" />
            {CLOUDS_S1.map((c, i) => <div key={i} className="cloud" style={{ width: c.w, height: c.h, top: c.top, left: c.left, "--blur": c.blur } as React.CSSProperties} />)}
            <div className="brand-box">
              <div style={{ fontSize: "3.5rem", marginBottom: "0.8rem", animation: "wordPop 0.7s ease 0.3s both", display: "block" }}>🎀</div>
              <div className="brand-name"><span style={{ color: "#1B4F8C" }}>Virtual</span> <span style={{ color: "#E07FAA" }}>Gender</span> Reveal</div>
              <div className="brand-tag">Crafted for Moments That Matter</div>
              <button className="enter-btn" onClick={advance}>✦ &nbsp; Enter the Experience</button>
            </div>
            <SceneProgress current={scene} />
          </div>
        )}
      </div>
    </>
  );
}

function SceneProgress({ current }: { current: number }) {
  return (
    <div className="scene-progress">
      {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className={`sp-dot${i === current ? " active" : ""}`} />)}
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────────
function LandingToast({ message, type, onClose }: { message: string; type: "success" | "error" | "info"; onClose: () => void }) {
  const c = { success: "#22c55e", error: "#ef4444", info: "#2E7DD1" }[type];
  const icon = { success: "✓", error: "✕", info: "ℹ" }[type];
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(17,24,39,0.97)", border: `1px solid ${c}40`, borderLeft: `3px solid ${c}`, borderRadius: 10, padding: "14px 18px", maxWidth: 360, boxShadow: "0 8px 30px rgba(0,0,0,0.4)", fontFamily: "'Plus Jakarta Sans',sans-serif", animation: "toastIn .3s ease-out" }}>
      <span style={{ color: c, fontSize: 15, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ color: "#f9fafb", fontSize: 13, fontWeight: 400, lineHeight: 1.5, flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.3)", cursor: "pointer", fontSize: 16, padding: 0, marginLeft: 6 }}>×</button>
    </div>
  );
}

// ── Confirm Dialog ───────────────────────────────────────────
type PlanMeta = { id: string; name: string; price: number; priceLabel: string; color: string };

function ConfirmDialog({ plan, onConfirm, onCancel }: { plan: PlanMeta; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0b1e]/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in font-jakarta">
      <div className="bg-white border border-[#f1f1f5] rounded-3xl shadow-2xl p-6 md:p-8 max-w-md w-full relative overflow-hidden animate-fade-up">
        {/* Decorative Glows matching login screen card */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-[#E8449A]/15 to-transparent blur-xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-[#3A9FE8]/15 to-transparent blur-xl pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-[#E8449A] uppercase tracking-widest">Payment Gateway</span>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: plan.color, boxShadow: `0 0 10px ${plan.color}` }} />
          </div>
          
          <h2 className="font-nunito font-extrabold text-2xl text-gray-900 mb-3 leading-tight">
            Taking you to payment gateway
          </h2>
          
          <p className="text-sm text-gray-500 leading-relaxed font-semibold mb-6">
            You selected the <strong className="text-gray-800">{plan.name}</strong> plan for <strong className="text-gray-800">{plan.priceLabel}</strong>. Proceed to secure Stripe Checkout or cancel to return to the pricing plans.
          </p>
          
          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              type="button"
              className="border border-gray-200 text-[#374151] hover:bg-gray-50 rounded-xl py-2 px-4.5 font-bold text-xs uppercase tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] cursor-pointer"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white hover:opacity-90 active:scale-[0.98] rounded-xl py-2 px-5 font-bold text-xs shadow-md tracking-wider uppercase transition-all focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] cursor-pointer"
              onClick={onConfirm}
            >
              Proceed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Landing Page ─────────────────────────────────────────────
function LandingPage() {
  const { user, loading, firestoreUser } = useAuth();
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<PlanMeta | null>(null);
  const [checkingEntitlement, setCheckingEntitlement] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);

  useEffect(() => {
    if (showFaqModal || showStoryModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showFaqModal, showStoryModal]);

  function handleConfirm() {
    if (!confirmPlan) return;
    setConfirmPlan(null);
    routeToReveal(confirmPlan.id, true);
  }

  const routeToReveal = async (plan?: string, confirmedPayment = false) => {
    const checkoutTarget = plan ? `/dashboard?checkout=${plan}${confirmedPayment ? "&confirmed=1" : ""}` : null;
    const targetReveal = "/new-reveal";

    if (!user) {
      const redirect = encodeURIComponent(checkoutTarget ?? targetReveal);
      router.push(`/login?redirect=${redirect}`);
      return;
    }

    if (checkoutTarget) {
      setToast({ message: "Taking you to the payment gateway...", type: "info" });
      router.push(checkoutTarget);
      return;
    }

    const role = firestoreUser?.role?.toLowerCase?.() ?? "";
    if (role === "admin") {
      router.push("/admin");
      return;
    }

    setCheckingEntitlement(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/entitlement/can-create", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.canCreate) {
        router.push(targetReveal);
        return;
      }
      router.push(data?.activePlan && data.activePlan !== "none" ? "/dashboard?needsRepurchase=1" : "/dashboard?noEntitlement=1");
    } catch {
      router.push("/dashboard?noEntitlement=1");
    } finally {
      setCheckingEntitlement(false);
    }
  };

  function handlePricingPlanClick(plan: PlanMeta) {
    if (plan.price > 0) {
      setConfirmPlan(plan);
      return;
    }
    void routeToReveal(plan.id);
  }

  return (
    <>
      <style>{LANDING_CSS}</style>
      {toast && <LandingToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirmPlan && <ConfirmDialog plan={confirmPlan} onConfirm={handleConfirm} onCancel={() => setConfirmPlan(null)} />}

      <nav id="main-nav">
        <a href="/" className="nav-logo" aria-label="Virtual Gender Reveal home">
          <SiteLogo className="nav-logo-img" />
          <span className="nav-logo-text">VGR</span>
        </a>
        <div className="nav-links">
          <a href="/" className="nav-link nav-link-active">Home</a>
          <button type="button" className="nav-link" onClick={() => routeToReveal()}>Create Party</button>
          <a href="#how" className="nav-link">How It Works</a>
          <button type="button" onClick={() => setShowStoryModal(true)} className="nav-link">Our Story</button>
          <button type="button" onClick={() => setShowFaqModal(true)} className="nav-link">FAQ</button>
        </div>
        <div className="nav-right">
          {loading ? null : user ? (
            <a href={(firestoreUser?.role?.toLowerCase?.() === "admin") ? "/admin" : "/dashboard"} className="nav-user-link">Logged in as {user.displayName || user.email || "Account"}</a>
          ) : (
            <a href="/login" className="nav-login-btn">👤 Log In</a>
          )}
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-left">
            <img
              src="/assets/VirtualGenderRevealPartyText.png"
              alt="Virtual Gender Reveal Party!"
              className="hero-title-img"
            />
            <p className="hero-sub-new">Because every reveal deserves a story.</p>
            <button type="button" className="btn-create-party" onClick={() => routeToReveal()} disabled={checkingEntitlement}>{checkingEntitlement ? "Checking..." : "🎉 Create Your Party"}</button>
            <div className="hero-tagline">👥 Invite. Reveal. Celebrate!</div>
          </div>
          <div className="hero-right">
            <div className="hero-card-mock hero-card-video">
              <img src="/assets/liveVideoBox.png" alt="Live reveal preview" className="hero-mock-video" />
            </div>
          </div>
        </div>
      </section>

            <section className="hiw-new-section" id="how">
        <div className="hiw-overlay" />
        <div className="hiw-new-inner">
          <div className="hiw-new-header fade-up">
            <span className="hiw-sparkle">✨</span>
            <h2 className="hiw-main-title">How it Works</h2>
            <span className="hiw-sparkle">✨</span>
          </div>
          <div className="hiw-cards-row fade-up">
            {[
              { img: "/assets/how-it-works/create-your-party.png",  tc: "hct-1", title: "Create Your Party",  desc: "Set up your virtual gender reveal party in minutes and customize every detail." },
              { img: "/assets/how-it-works/invite-loved-ones.png",  tc: "hct-2", title: "Invite Loved Ones",  desc: "Send invites to friends and family near or far. Everyone can join!" },
              { img: "/assets/how-it-works/time-to-reveal.png",     tc: "hct-3", title: "Time to Reveal",     desc: "Open the box and reveal the big surprise together in real-time!" },
              { img: "/assets/how-it-works/celebrate-together.png", tc: "hct-4", title: "Celebrate Together", desc: "Share reactions, take photos, and make memories that last forever." },
            ].map((s, i) => (
              <div className="hiw-new-card" key={i}>
                <img src={s.img} alt={s.title} className="hiw-card-img" />
                <div className={`hiw-card-title ${s.tc}`}>{s.title}</div>
                <div className="hiw-card-desc">{s.desc}</div>
              </div>
            ))}
          </div>
          <div className="hiw-feat-bar fade-up">
            {[
              { icon: "👥", cls: "",       label: "Join Anywhere",    sub: "Everyone can join from any device."        },
              { icon: "🔒", cls: "blue",   label: "Private & Secure", sub: "Your moment, your privacy."               },
              { icon: "💬", cls: "purple", label: "Live Chat",        sub: "Chat, react and share the excitement!"    },
              { icon: "📸", cls: "green",  label: "Capture Memories", sub: "Save and download your special moments."  },
            ].map((f, i) => (
              <div className="hiw-feat-item" key={i}>
                <div className={`hiw-feat-icon ${f.cls}`}>{f.icon}</div>
                <div className="hiw-feat-text"><strong>{f.label}</strong><span>{f.sub}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

{/*
      <section className="feat-bg" id="features">
        <div className="linner">
          <div className="fade-up">
            <div className="ltag">What Sets Us Apart</div>
            <h2 className="ltitle">Everything your reveal needs.<br /><em>Built in, not bolted on.</em></h2>
            <p className="lsub">Every feature is included in every plan. No add-ons. No surprise charges.</p>
          </div>
          <div className="feat-grid fade-up">
            {[
              { icon: "🔐", title: "Doctor-Secured Gender Submission", desc: "A private, one-time secure link. One click. A simple form. The link deactivates immediately and expires in 7 days." },
              { icon: "📡", title: "Live Broadcast to Every Guest at Once", desc: "At the exact time you set, your reveal streams live to every guest simultaneously — same second, no delay." },
              { icon: "🎉", title: "Virtual Party Room with Live Chat & Polls", desc: "Guests join before the reveal, vote in the Boy or Girl poll, and chat in real time." },
              { icon: "💌", title: "Beautiful Personalized Invitations", desc: "Upload a CSV or add emails manually. We send personalized invitations with a unique secure watch link." },
              { icon: "📅", title: "30-Day Replay Window", desc: "Your reveal stays available for 30 days. On day 30 it's permanently deleted." },
              { icon: "🎬", title: "Personalized Videos — Made by Humans", desc: "Your baby's nickname. Your names. Your chosen style. A video made for this moment." },
              { icon: "📱", title: "Works on Every Device — Zero Downloads", desc: "iPhone, Android, Windows, Mac, iPad, smart TV. If it can open a browser, it can join the reveal." },
              { icon: "🔒", title: "Encrypted & CCPA Compliant", desc: "All data encrypted in transit and at rest. Complete deletion on request. We never sell your data." },
            ].map((f, i) => (
              <div className="feat-card" key={i}>
                <span style={{ fontSize: "1.6rem", marginBottom: "1rem", display: "block" }}>{f.icon}</span>
                <div className="feat-title">{f.title}</div>
                <div className="feat-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      */}

      <section className="pricing-section" id="pricing">
        <div className="pricing-bg-dec pricing-bg-left">🎈<br />🎈</div>
        <div className="pricing-bg-dec pricing-bg-right">🎈</div>
        <div className="pricing-inner">
          <div className="pricing-header fade-up">
            <div className="pricing-pill-badge">💜 Choose Your Plan</div>
            <h2 className="pricing-main-title">
              <span className="pricing-title-line1">Simple Plans,</span>
              <span className="pricing-title-line2">Perfect Celebrations!</span>
            </h2>
            <p className="pricing-sub">Pick the perfect plan for your virtual gender reveal party.</p>
            {!loading && !user && (
              <p style={{ fontSize: 13, color: "#E8449A", marginTop: 8, fontStyle: "italic" }}>Sign in or create an account to choose a plan ✦</p>
            )}
          </div>
          <div className="pricing-grid fade-up">
            {[
              { cardCls: "pnew-basic",   iconCls: "pic-pink",   icon: "🎈", nameCls: "pn-pink", name: "Freemium", desc: "Everything you need for a simple & fun reveal!",   priceCls: "pp-pink", price: "0",   priceSub: "Free for a limited time", checkCls: "pnew-check-pink", feats: ["Basic reveal page", "Doctor secure link", "Up to 20 guests", "Email invitations", "7-day replay"], btnCls: "pbtn-pink",     btnLabel: "Start Freemium",        planId: "basic",    popular: false },
              { cardCls: "pnew-premium", iconCls: "pic-purple", icon: "👑", nameCls: "pn-blue", name: "Premium", desc: "The most loved plan for unforgettable memories!", priceCls: "pp-blue", price: "59.99", priceSub: "One-time payment", checkCls: "pnew-check-blue", feats: ["Cinematic reveal video — made by us", "Live virtual party room", "Up to 200 guests", "Live chat & Boy/Girl polls", "Personalized guest invitations", "30-day replay window", "Custom overlay"], btnCls: "pbtn-gradient", btnLabel: "Choose Premium",        planId: "premium", popular: true  },
            ].map((p, i) => (
              <div className={`pnew-card ${p.cardCls}`} key={i}>
                {p.popular && <div className="pnew-popular-badge">⭐ MOST POPULAR</div>}
                <div className={`pnew-icon-circle ${p.iconCls}`}>{p.icon}</div>
                <div className={`pnew-name ${p.nameCls}`}>{p.name}</div>
                <div className="pnew-desc">{p.desc}</div>
                <div className="pnew-price">
                  {p.planId === "basic" ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ fontSize: "14px", textDecoration: "line-through", color: "#bbb", fontWeight: "bold" }}>$29.99</span>
                      <span className={`pnew-price-main ${p.priceCls}`} style={{ marginTop: "4px" }}>
                        <span className="pnew-price-curr">$</span><span className="pnew-price-amt">0</span>
                      </span>
                    </div>
                  ) : (
                    <span className={`pnew-price-main ${p.priceCls}`}>
                      <span className="pnew-price-curr">$</span><span className="pnew-price-amt">{p.price}</span>
                    </span>
                  )}
                </div>
                <div className="pnew-price-sub">{p.priceSub}</div>
                <div className="pnew-divider" />
                <ul className="pnew-feats">
                  {p.feats.map((f, j) => <li key={j}><span className={p.checkCls}>✓</span>{f}</li>)}
                </ul>
                <button
                  className={`pnew-btn ${p.btnCls}`}
                  onClick={() => handlePricingPlanClick({
                    id: p.planId,
                    name: p.name,
                    price: Number(p.price),
                    priceLabel: p.price === "0" ? "Free" : `$${p.price}`,
                    color: p.popular ? "#82B8E8" : "#E8449A",
                  })}
                >
                  {p.btnLabel}
                </button>
              </div>
            ))}
          </div>
          <div className="pricing-trust fade-up">
            <span>🔒 Secure Payments</span>
            <div className="pricing-trust-divider" />
            <span>100% Safe &amp; Encrypted</span>
            <div className="pricing-trust-divider" />
            <span>No hidden fees.</span>
          </div>
        </div>
      </section>

      <section className="testi-new-section">
        <div className="testi-heart-left">💗</div>
        <div className="testi-heart-right">💙</div>
        <div className="testi-new-inner">
          <div className="testi-new-header fade-up">
            <div className="testi-pill-badge">💗 Loved by Thousands</div>
            <h2 className="testi-main-title">What Our <span className="testi-title-pink">Users</span> Say</h2>
            <p className="testi-new-sub">Real stories. Real smiles. Real celebrations. 💗</p>
          </div>
          <div className="testi-new-grid fade-up">
            {[
              {
                title: "This was 100% worth it.",
                q: "“We wanted something different, exciting, and most importantly, a safe way to share our big news. The virtual horse race made the reveal unforgettable, and our friends are still talking about it weeks later.”",
                name: "Brandon C.",
                role: "Dad-to-be",
                av: "👨",
                starCls: "testi-stars-pink",
                nameCls: "tn-pink",
                heart: "💗"
              },
              {
                title: "So easy, so simple, so exciting.",
                q: "“Setting everything up was so quick and stress-free. Invites went out in minutes, and everyone joined right on time. We all experienced the surprise at the exact same moment. It was perfect!”",
                name: "Lauren M.",
                role: "Mom-to-be",
                av: "👩",
                starCls: "testi-stars-purple",
                nameCls: "tn-purple",
                heart: "💜"
              },
              {
                title: "Safe, meaningful, and magical.",
                q: "“We wanted a way to celebrate that was safe for everyone but still felt just as special. The horse race had us on the edge of our seats and the ending brought happy tears!”",
                name: "Jessica R.",
                role: "Mom-to-be",
                av: "👩",
                starCls: "testi-stars-blue",
                nameCls: "tn-blue",
                heart: "💙"
              },
              {
                title: "Finally, a gender reveal that's more than just a balloon pop.",
                q: "“It felt like watching a mini Pixar movie with an unforgettable surprise at the end. We were literally on the edge of our seats through the entire race!”",
                name: "Megan B.",
                role: "Aunt",
                av: "👩",
                starCls: "testi-stars-purple",
                nameCls: "tn-purple",
                heart: "💜"
              },
            ].map((t, i) => (
              <div className="testi-new-card" key={i}>
                <div className="testi-avatar-placeholder">{t.av}</div>
                <div className={`testi-new-stars ${t.starCls}`}>★★★★★</div>
                <div className="testi-new-title">{t.title}</div>
                <div className="testi-new-q">{t.q}</div>
                <div className={`testi-new-name ${t.nameCls}`}>{t.name}</div>
                <div className="testi-new-role">{t.role}</div>
                <div className="testi-card-heart">{t.heart}</div>
              </div>
            ))}
          </div>
          <div className="testi-stats-bar fade-up">
            {[
              { icon: "👥", iconCls: "tsi-pink",   num: "50K+", label: "Happy Families" },
              { icon: "🎉", iconCls: "tsi-blue",   num: "25K+", label: "Parties Hosted" },
              { icon: "🌐", iconCls: "tsi-purple", num: "100+", label: "Countries"       },
              { icon: "💗", iconCls: "tsi-gold",   num: "4.9",  label: "Average Rating"  },
            ].map((s, i) => (
              <div className="testi-stat-item" key={i}>
                <div className={`testi-stat-icon ${s.iconCls}`}>{s.icon}</div>
                <div className="testi-stat-text"><strong>{s.num}</strong><span>{s.label}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-new-section" id="contact">
        <div className="cta-bg-dec cta-bg-left">🎈</div>
        <div className="cta-bg-dec cta-bg-right">💗</div>
        <div className="cta-new-inner">
          <div className="cta-pill-badge">💗 Your Moment Awaits</div>
          <h2 className="cta-new-title">
            Your family is waiting<br />
            <span className="cta-title-gradient">to find out together.</span>
          </h2>
          <p className="cta-new-sub">Book your reveal today and your doctor link will be ready within the hour.</p>
          <p className="cta-new-sub2">Grandma in Florida and your best friend in New York will both be there.</p>
          <button type="button" className="cta-new-btn" onClick={() => routeToReveal()} disabled={checkingEntitlement}>{checkingEntitlement ? "Checking..." : "🎉 Start Your Reveal"}</button>
          <div className="cta-new-box">
            <p>Virtual Baby Reveal is designed to make your special moment joyful, seamless, and completely stress-free.</p>
            <p><em>Because moments like these deserve to be felt together.</em></p>
          </div>
        </div>
      </section>



      {showStoryModal && (
        <div className="faq-modal-overlay" onClick={() => setShowStoryModal(false)}>
          <div className="faq-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px' }}>
            <button type="button" className="faq-modal-close" onClick={() => setShowStoryModal(false)}>✕</button>
            <div className="faq-header" style={{ marginBottom: '2.5rem' }}>
              <div className="faq-badge" style={{ borderColor: '#E8449A', color: '#E8449A' }}>💙🩷 Our Story</div>
              <h2 className="faq-title" style={{ fontFamily: "'Nunito', sans-serif", fontSize: '2.2rem', fontWeight: 900 }}>Because Every Reveal Deserves a Story</h2>
            </div>
            
            <div className="story-content-text" style={{ position: 'relative', zIndex: 1, color: '#2c3e50', fontSize: '0.96rem', lineHeight: '1.85', display: 'flex', flexDirection: 'column', gap: '1.2rem', maxHeight: '55vh', overflowY: 'auto', paddingRight: '0.8rem', scrollbarWidth: 'thin', textAlign: 'left', fontWeight: 500 }}>
              <p className="font-bold text-slate-800 text-lg">It started with a simple question…</p>
              
              <p>Like so many expecting parents, we started planning our gender reveal the same way everyone else does: <strong>Balloon pops. Cake cutting. Confetti cannons. Colored smoke.</strong></p>
              
              <p>But something about them felt… <em>incomplete</em>.</p>
              
              <p>They’re over in seconds. One pop. One slice. One puff of smoke.</p>
              
              <p>The surprise is amazing, but the experience leading up to it is over almost as quickly as it begins. We wanted our family and friends to experience the same anticipation, excitement, and joy we were feeling. Not just discover whether we were having a boy or a girl, but share the journey with us every step of the way.</p>
              
              <p>Then there was something else we couldn’t ignore. Every year, we saw stories of gender reveals that went wrong. Fires sparked by pyrotechnics. Homes damaged. Guests injured. Celebrations that were meant to bring people together instead ended in heartbreak.</p>
              
              <p>We thought… There has to be a better way. A way that’s exciting. A way that’s interactive. A way that’s memorable. And above all… <strong>A way that’s safe.</strong></p>
              
              <p>We kept asking ourselves: <em>What if the reveal wasn’t just the ending? What if the journey to the surprise was just as exciting?</em></p>
              
              <p>That single question sparked an idea we couldn’t stop thinking about. We imagined a reveal that felt like watching the final moments of the Kentucky Derby. The anticipation builds. Everyone is on the edge of their seat. Family and friends are cheering, laughing, making predictions, and eagerly waiting to see who crosses the finish line first.</p>
              
              <p>Except instead of winning a trophy… The finish line reveals the biggest surprise of your life… the moment you discover whether you’re welcoming a little boy or a little girl.</p>
              
              <p>Suddenly, your reveal isn’t just something people watch. <strong>It’s something they experience.</strong> For a few unforgettable minutes, everyone forgets they’re watching a gender reveal and starts cheering like they’re watching the biggest race of the year.</p>
              
              <p>Guests begin making their predictions before the race even starts: <em>“Team Boy!” “Team Girl!”</em> Families text each other their predictions. Kids cheer for their favorite baby. Grandparents lean closer to the screen. Friends start shouting at the TV. Everyone has a favorite to win.</p>
              
              <p>Every stride toward the finish line builds more anticipation until the entire room is waiting for one incredible moment. For those unforgettable few minutes, everyone shares the same anticipation, excitement, and joy… together.</p>
              
              <p>We spent countless hours designing adorable animated babies, breathtaking race tracks, cinematic music, magical scenery, exciting twists, crowd reactions, and a surprise ending that keeps everyone guessing until the very last second.</p>
              
              <p>Every twist. Every laugh. Every cheer. All leading to the moment you’ve been waiting for.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', background: 'rgba(255,255,255,0.4)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.6)' }}>
                <span className="font-semibold text-gray-700">🚫 No cleanup</span>
                <span className="font-semibold text-gray-700">🚫 No fire hazards</span>
                <span className="font-semibold text-gray-700">🚫 No smoke / explosives</span>
                <span className="font-semibold text-gray-700">✈️ No travel required</span>
              </div>
              
              <p>Just one unforgettable experience shared by everyone you love, whether they’re across town or across the world. Parents can relax knowing everyone is enjoying the celebration safely from the comfort of their own home while still sharing the excitement together.</p>
              
              <p>But unlike a traditional gender reveal that’s remembered only through a few photos or cell phone videos… <strong>Your race becomes a keepsake.</strong> You’ll receive your personalized animated reveal video to download and keep forever. Years from now, you’ll be able to press play and relive the excitement all over again. One day, you’ll even get to watch it with the little boy or girl who was racing to the finish line.</p>
              
              <p>You’ll laugh. You’ll smile. You’ll remember exactly how that unforgettable moment felt. Because it’s more than a gender reveal. It’s the very first chapter of your baby’s story.</p>
              
              <hr style={{ border: 'none', borderTop: '1px dashed rgba(0,0,0,0.1)', margin: '0.8rem 0' }} />
              
              <p className="font-black text-slate-800 text-lg flex items-center gap-1.5" style={{ color: '#3A9FE8' }}>💙 Already Know the Gender?</p>
              
              <p>That’s perfectly okay!</p>
              
              <p>Whether you’ve already found out you’re having a boy or girl, or simply prefer not to have the surprise yourself, your personalized animated race becomes a one-of-a-kind announcement your family and friends will never forget. Instead of sending a text message, posting a photo, or making a quick phone call, invite everyone to experience the excitement together.</p>
              
              <p>They’ll still enjoy the anticipation, cheer for their favorite baby, and celebrate as the race builds toward the unforgettable finish line. You already know the ending. They don’t. Or maybe you’re all celebrating together. Either way, the magic isn’t just discovering the answer. <strong>It’s sharing the journey.</strong></p>
              
              <p>Your personalized animated race becomes a keepsake you’ll treasure forever. Years from now, you can press play and relive one of life’s happiest moments with the very child who was racing to the finish line. Because whether it’s a gender reveal or a baby announcement, every growing family deserves a celebration that’s interactive, emotional, unforgettable… and a story worth telling.</p>
              
              <hr style={{ border: 'none', borderTop: '1px dashed rgba(0,0,0,0.1)', margin: '0.8rem 0' }} />
              
              <p>Today, Virtual Gender Reveal allows families to invite guests from anywhere in the world to watch together on their phone, tablet, computer, or TV. Whether you’re celebrating with 10 guests or 1,000, everyone experiences the excitement at exactly the same moment.</p>
              
              <p>It’s a celebration that’s safe for everyone, unforgettable for your guests, and timeless for your family.</p>
              
              <p className="font-bold text-slate-800" style={{ color: '#E8449A' }}>Because every reveal deserves anticipation. Every family deserves excitement.</p>
              
              <p className="font-black text-center text-lg mt-2" style={{ letterSpacing: '0.15em', color: '#1B4F8C' }}>Because Every Reveal Deserves a Story. 💙🩷</p>
            </div>
          </div>
        </div>
      )}

      {showFaqModal && (
        <div className="faq-modal-overlay" onClick={() => setShowFaqModal(false)}>
          <div className="faq-modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="faq-modal-close" onClick={() => setShowFaqModal(false)}>✕</button>
            <div className="faq-header">
              <div className="faq-badge">💡 Got Questions?</div>
              <h2 className="faq-title">Frequently Asked Questions</h2>
              <p className="faq-sub">Everything you need to know about celebrating your virtual reveal with family and friends.</p>
            </div>

            <div className="faq-scroll-area" style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: '0.5rem', scrollbarWidth: 'thin', position: 'relative', zIndex: 1 }}>
              <div className="faq-list">
                {[
                  {
                    q: "What is Virtual Gender Reveal?",
                    a: "Virtual Gender Reveal is a modern, interactive, and safe way to celebrate one of life’s biggest moments. Family and friends gather online from anywhere in the world to watch an exciting animated baby race that ends with the unforgettable reveal of whether you’re having a boy or a girl."
                  },
                  {
                    q: "How does everyone watch?",
                    a: "Simply share your unique viewing link with your guests. They can watch from anywhere on their phone, tablet, computer, or smart TV."
                  },
                  {
                    q: "Can we watch on our TV?",
                    a: "Yes! Most guests watch on a big-screen TV using AirPlay, Chromecast, a smart TV browser, or an HDMI connection for the best experience."
                  },
                  {
                    q: "Do the parents know the gender beforehand?",
                    a: "No. You choose someone you trust (doctor, friend, or family member). They can securely submit the baby’s gender so the surprise stays a surprise for everyone, including you."
                  },
                  {
                    q: "How is the gender kept secret?",
                    a: "Your private reveal link allows only your chosen “revealer” to submit the gender. Parents never see the selection before the race begins."
                  },
                  {
                    q: "How long is the race?",
                    a: "The race lasts about 3 minutes, making it exciting without keeping guests waiting."
                  },
                  {
                    q: "Can guests join from different locations?",
                    a: "Absolutely! Friends and family from anywhere in the world can watch together."
                  },
                  {
                    q: "Can we all watch at exactly the same time?",
                    a: "Yes! Once the countdown reaches zero, everyone watching your private reveal page sees the race begin together, creating one shared moment no matter where they are."
                  },
                  {
                    q: "Do guests need to download an app?",
                    a: "No downloads are required. Guests simply click the link and enjoy the reveal."
                  },
                  {
                    q: "Will there be a countdown before the reveal?",
                    a: "Yes! A fun countdown builds anticipation before the race automatically begins."
                  },
                  {
                    q: "Can I schedule my reveal in advance?",
                    a: "Yes! Pick your reveal date and time, and your page will automatically count down until it’s time."
                  },
                  {
                    q: "Is my reveal private?",
                    a: "Yes. Every reveal has its own private viewing link that you control."
                  },
                  {
                    q: "What devices work?",
                    a: "Phones, tablets, laptops, desktop computers, and most smart TVs all work great."
                  },
                  {
                    q: "What happens if my internet is slow?",
                    a: "The video is optimized to stream smoothly on most internet connections. For the best experience, we recommend using Wi-Fi whenever possible."
                  },
                  {
                    q: "Can I send invitations through the website?",
                    a: "Yes! We make it easy to invite your guests using your personalized reveal page."
                  },
                  {
                    q: "What if I need help?",
                    a: "Our support team is here to help before your reveal so everything runs smoothly."
                  },
                  {
                    q: "Should I turn my sound on?",
                    a: "Definitely! 🔊 This isn’t just a video…it’s a show. Enjoy exciting race commentary, epic music, crowd reactions, and fun sound effects that make the reveal feel like a live sporting event. Grab some snacks, turn up the volume, and get ready for an unforgettable finish!"
                  }
                ].map((faq, idx) => {
                  const isActive = activeFaq === idx;
                  return (
                    <div key={idx} className={`faq-item ${isActive ? "active" : ""}`}>
                      <button
                        type="button"
                        className="faq-question-btn"
                        onClick={() => setActiveFaq(isActive ? null : idx)}
                        aria-expanded={isActive}
                      >
                        <span>{faq.q}</span>
                        <span className="faq-icon">{isActive ? "✕" : "＋"}</span>
                      </button>
                      <div className="faq-answer">
                        <p>{faq.a}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="footer-new">
        <div className="footer-new-inner">
          <div className="footer-new-top">
            <div className="footer-brand-col">
              <a href="/" className="footer-logo-new">
                <span>💙🩷</span>
                <span className="footer-logo-text">VGR</span>
              </a>
              <div className="footer-logo-sub">Virtual Gender Reveal</div>
              <div className="footer-tagline-text">Crafted for Moments That Matter</div>
              <div className="footer-copy-text">The world&apos;s most heartfelt virtual gender reveal platform.</div>
            </div>
            {[
              { title: "Platform", links: ["How It Works", "Features", "Pricing", "Sample Videos"] },
              { title: "Support",  links: ["Help Centre", "Contact Us", "Doctor Guide", "Privacy Policy"] },
              { title: "Company",  links: ["About", "Blog", "Terms of Service", "CCPA / Privacy"] },
            ].map((col, i) => (
              <div key={i}>
                <div className="footer-col-title">{col.title}</div>
                <ul className="footer-col-links">
                  {col.links.map((l, j) => <li key={j}><a href="#">{l}</a></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="footer-new-bottom">
            <span>© 2026 Virtual Gender Reveal. All rights reserved.</span>
            <span>Because moments like these deserve to be felt together. 💗</span>
          </div>
        </div>
      </footer>
    </>
  );
}

const CINEMA_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,300;0,400;1,300;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
@keyframes fadeInSkip{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
@keyframes toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
@keyframes fadeOverlay{from{opacity:0}to{opacity:1}}
@keyframes slideUpDlg{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--gold-light:#E8D18A}
body{font-family:'Plus Jakarta Sans',sans-serif;overflow-x:hidden}
#cinema{position:fixed;inset:0;z-index:9999;background:#0a0a14;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden}
#cinema.fade-out{animation:cinemaExit 0.7s cubic-bezier(0.4,0,0.2,1) forwards}
@keyframes cinemaExit{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.04)}}
.skip-btn{position:fixed;top:24px;right:24px;z-index:10000;display:flex;align-items:center;gap:8px;padding:10px 20px;background:rgba(10,6,8,0.6);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:rgba(255,255,255,0.7);font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:400;letter-spacing:2px;text-transform:uppercase;cursor:pointer;backdrop-filter:blur(12px);transition:all 0.2s;animation:fadeInSkip 0.5s ease-out 0.8s both}
.skip-btn:hover{background:rgba(10,6,8,0.88);border-color:rgba(255,255,255,0.3);color:#fff}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;pointer-events:none}
.scene.active{pointer-events:auto;animation:sceneIn 0.7s ease forwards}
@keyframes sceneIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.s1-sky{position:absolute;inset:0;background:radial-gradient(ellipse 100% 80% at 50% 30%,#C8E6FF 0%,#A8D4F5 25%,#7EB8E8 50%,#5090C8 75%,#1B3A6B 100%)}
.s2-bg{position:absolute;inset:0;background:radial-gradient(ellipse 120% 100% at 50% 20%,#B8D8F8 0%,#90C4F0 30%,#4A8AC8 65%,#1A2E5A 100%)}
.s3-bg{position:absolute;inset:0;background:linear-gradient(180deg,#1A0A00 0%,#3D1A00 40%,#1A0A00 100%)}
.s4-bg{position:absolute;inset:0;background:linear-gradient(180deg,#0A1A3A 0%,#12306B 40%,#0A1A3A 100%)}
.cloud{position:absolute;border-radius:50%;background:rgba(255,255,255,0.85);filter:blur(var(--blur,18px));animation:cloudDrift 9s ease-in-out infinite alternate}
@keyframes cloudDrift{from{transform:translateX(0)}to{transform:translateX(20px)}}
.bird-wrap{position:absolute;top:32%;left:50%;transform:translate(-50%,-50%);animation:birdGlide 3s ease-in-out infinite alternate;filter:drop-shadow(0 8px 24px rgba(0,80,180,0.25))}
@keyframes birdGlide{from{transform:translate(-50%,-50%) translateY(-10px) rotate(-2deg)}to{transform:translate(-50%,-50%) translateY(10px) rotate(2deg)}}
.cin-text{position:relative;z-index:10;text-align:center;animation:fadeUp 1s ease 0.5s both}
.cin-text p{font-family:'Playfair Display',serif;font-size:clamp(1.6rem,4vw,2.8rem);font-style:italic;font-weight:300;color:rgba(255,255,255,0.95);text-shadow:0 2px 24px rgba(0,60,140,0.5);letter-spacing:0.02em;line-height:1.4}
.dot-row{margin-top:1rem;font-size:0.65rem;letter-spacing:0.35em;color:rgba(255,255,255,0.35);animation:dotPulse 2s ease infinite}
@keyframes dotPulse{0%,100%{opacity:0.35}50%{opacity:0.85}}
.bundle-orb{width:90px;height:90px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:2.4rem;animation:orbPulse 2s ease-in-out infinite}
.bundle-blue{background:radial-gradient(circle at 35% 35%,#A8D8FF,#2E7DD1);box-shadow:0 0 60px rgba(46,125,209,0.6)}
.bundle-pink{background:radial-gradient(circle at 35% 35%,#FFB8D8,#E07FAA);box-shadow:0 0 60px rgba(224,127,170,0.6)}
.bundle-label{font-size:0.72rem;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.6)}
@keyframes orbPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes bundleFloat{from{transform:translateY(-8px)}to{transform:translateY(8px)}}
.arena-light{position:absolute;top:0;width:2px;opacity:0.6;background:linear-gradient(to bottom,rgba(255,220,100,0.8),transparent);height:35%;animation:lightSway 3s ease-in-out infinite alternate}
.arena-light:nth-child(odd){animation-direction:alternate-reverse}
@keyframes lightSway{from{transform:rotate(-3deg)}to{transform:rotate(3deg)}}
.track-surface{height:60px;border-radius:8px;position:relative;overflow:hidden;background:linear-gradient(90deg,#2A1500,#8B4513,#6B3410,#2A1500);border:2px solid rgba(255,200,100,0.3);box-shadow:0 0 40px rgba(255,150,50,0.2)}
.track-lane{position:absolute;left:0;right:0;height:1px;background:rgba(255,220,100,0.2)}
.horse-arrive{position:absolute;top:50%;transform:translateY(-50%);font-size:1.5rem;animation:horseArrive 1.5s cubic-bezier(0.22,1,0.36,1) 0.5s both}
@keyframes horseArrive{from{left:-20%}to{left:20%}}
.crowd-dots{position:absolute;top:0;left:0;right:0;height:30%;background-image:radial-gradient(circle 2px at 50% 50%,rgba(255,255,255,0.4) 0%,transparent 100%);background-size:20px 16px;animation:crowdWave 2s ease infinite alternate;mask-image:linear-gradient(to bottom,black 50%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,black 50%,transparent 100%)}
@keyframes crowdWave{from{opacity:0.3}to{opacity:0.7}}
.race-lane{height:64px;position:relative;margin-bottom:8px;border-radius:4px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)}
.lane-blue{background:linear-gradient(90deg,rgba(26,59,138,0.8),rgba(46,125,209,0.3))}
.lane-pink{background:linear-gradient(90deg,rgba(138,26,70,0.8),rgba(224,127,170,0.3))}
.racer{position:absolute;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:0.4rem;animation:raceRun 1.8s cubic-bezier(0.34,1.56,0.64,1) var(--rd,0s) forwards}
@keyframes raceRun{from{left:2%}to{left:var(--stop,55%)}}
@keyframes horseGallop{0%,100%{transform:scaleY(1) rotate(-2deg)}50%{transform:scaleY(0.92) rotate(2deg)}}
.race-label{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:0.7rem;letter-spacing:0.2em;text-transform:uppercase;font-weight:600;opacity:0.7}
.label-blue{color:#82B8E8}.label-pink{color:#F2B8CF}
.obstacle{position:absolute;top:50%;transform:translateY(-50%);font-size:1.6rem;animation:obstacleAppear 0.5s ease var(--oa,1s) both}
@keyframes obstacleAppear{from{opacity:0;transform:translateY(-50%) scale(0)}to{opacity:1;transform:translateY(-50%) scale(1)}}
.s5-half{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;animation:halfSlide 0.8s cubic-bezier(0.22,1,0.36,1) var(--hs,0s) both}
@keyframes halfSlide{from{transform:translateY(100%)}to{transform:translateY(0)}}
.s5-blue{background:linear-gradient(160deg,#0D2B6B 0%,#1B4F8C 40%,#2E7DD1 100%)}
.s5-pink{background:linear-gradient(160deg,#6B0D35 0%,#B03060 40%,#E07FAA 100%)}
.s5-divider{position:absolute;top:0;bottom:0;left:50%;width:3px;background:linear-gradient(to bottom,rgba(255,255,255,0.6),rgba(255,255,255,0.2));transform:translateX(-50%);z-index:20;box-shadow:0 0 20px rgba(255,255,255,0.5)}
.confetto{position:absolute;border-radius:2px;animation:confettiFall var(--cf-dur,2s) ease var(--cf-del,0s) infinite;opacity:0}
@keyframes confettiFall{0%{opacity:0;transform:translateY(-20px) rotate(0deg);top:0}10%{opacity:1}90%{opacity:0.6}100%{opacity:0;transform:translateY(100vh) rotate(720deg)}}
.reveal-big{font-family:'Playfair Display',serif;font-size:clamp(2.5rem,7vw,5.5rem);font-weight:400;color:white;text-align:center;text-shadow:0 4px 40px rgba(0,0,0,0.4);animation:wordPop 0.6s cubic-bezier(0.34,1.56,0.64,1) var(--wp,0.8s) both;line-height:1.1}
@keyframes wordPop{from{opacity:0;transform:scale(0.5)}to{opacity:1;transform:scale(1)}}
.brand-box{position:relative;z-index:10;text-align:center;animation:wordPop 1s cubic-bezier(0.22,1,0.36,1) 0.6s both}
.brand-name{font-family:'Playfair Display',serif;font-size:clamp(2rem,5vw,3.5rem);font-weight:400;color:#111827;letter-spacing:0.04em;margin-bottom:0.5rem}
.brand-tag{font-size:0.85rem;letter-spacing:0.28em;text-transform:uppercase;color:rgba(26,26,46,0.55);font-weight:300;margin-bottom:2rem}
.enter-btn{display:inline-block;padding:0.9rem 2.6rem;background:linear-gradient(135deg,#2E7DD1,#C2527A);color:white;border:none;border-radius:3px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;font-size:0.8rem;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;box-shadow:0 8px 28px rgba(46,125,209,0.3);transition:transform 0.2s}
.enter-btn:hover{transform:translateY(-2px)}
.scene-progress{position:absolute;bottom:32px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:100;align-items:center}
.sp-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.25);transition:background 0.3s,transform 0.3s}
.sp-dot.active{background:rgba(255,255,255,0.9);transform:scale(1.5)}
`;

const LANDING_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Playfair+Display:ital,wght@0,300;0,400;1,300;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#fff;color:#111827;overflow-x:hidden;}
.fade-up{opacity:0;transform:translateY(28px);transition:opacity 0.7s,transform 0.7s;}
.fade-up.visible{opacity:1;transform:translateY(0);}
nav{position:fixed;top:0;left:0;right:0;z-index:200;height:68px;display:flex;align-items:center;justify-content:space-between;padding:0 2.5rem;transition:background 0.4s,box-shadow 0.4s;}
nav.solid{background:rgba(255,255,255,0.92);backdrop-filter:blur(20px);box-shadow:0 1px 0 rgba(0,0,0,0.07);}
.nav-logo{font-family:'Playfair Display',serif;font-size:1.2rem;font-weight:400;color:#111827;text-decoration:none;line-height:1.2;}
.nav-logo strong{display:block;font-size:0.6rem;font-family:'Plus Jakarta Sans',sans-serif;letter-spacing:0.2em;text-transform:uppercase;color:#E07FAA;font-weight:400;}
.nav-links{display:flex;gap:1.8rem;align-items:center;}
.nav-links a{font-size:0.82rem;text-decoration:none;color:#6B7280;transition:color 0.2s;}
.nav-links a:hover{color:#111827;}
.nav-user{font-size:0.75rem;color:#1B4F8C;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.nav-user-link{font-size:0.78rem !important;color:#1B4F8C !important;font-weight:500;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.nav-user-link:hover{text-decoration:underline;}
.nav-cta-btn{font-size:0.78rem;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;padding:0.6rem 1.4rem;border-radius:3px;text-decoration:none;background:linear-gradient(135deg,#2E7DD1,#C2527A);color:white;}
.nav-cta-btn{border:none;cursor:pointer;}
.hero-section{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:7rem 2rem 5rem;position:relative;overflow:hidden;background:#fff;}
.hero-mesh{position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 12% 15%,rgba(130,184,232,0.18) 0%,transparent 55%),radial-gradient(ellipse 65% 55% at 88% 10%,rgba(242,184,207,0.2) 0%,transparent 52%);}
.hero-grid-bg{position:absolute;inset:0;background-image:linear-gradient(rgba(27,79,140,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(27,79,140,0.04) 1px,transparent 1px);background-size:64px 64px;mask-image:radial-gradient(ellipse 90% 90% at 50% 50%,black 20%,transparent 75%);-webkit-mask-image:radial-gradient(ellipse 90% 90% at 50% 50%,black 20%,transparent 75%);}
.hero-inner{position:relative;z-index:2;text-align:center;max-width:820px;}
.hero-pill{display:inline-flex;align-items:center;gap:0.5rem;margin-bottom:1.8rem;padding:0.42rem 1.1rem;border-radius:100px;border:1px solid rgba(194,82,122,0.28);background:rgba(253,232,242,0.7);backdrop-filter:blur(8px);font-size:0.7rem;letter-spacing:0.22em;text-transform:uppercase;color:#C2527A;font-weight:500;}
.hero-title{font-family:'Playfair Display',serif;font-size:clamp(3rem,8vw,6rem);font-weight:300;line-height:1.06;margin-bottom:1.5rem;}
.hero-title em{font-style:italic;}
.hero-sub{font-size:clamp(1rem,2vw,1.15rem);font-weight:300;line-height:1.8;color:#6B7280;max-width:560px;margin:0 auto 2.8rem;}
.hero-auth-note{font-size:0.8rem;color:#1B4F8C;background:rgba(214,234,254,0.7);border:1px solid rgba(46,125,209,0.25);display:inline-block;padding:0.5rem 0.9rem;border-radius:999px;margin-bottom:1.4rem;}
.btn-main{display:inline-flex;align-items:center;gap:0.4rem;padding:1rem 2.2rem;border-radius:3px;text-decoration:none;font-size:0.84rem;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;background:linear-gradient(135deg,#2E7DD1,#C2527A);color:white;box-shadow:0 6px 24px rgba(46,125,209,0.25);transition:transform 0.22s,box-shadow 0.22s;}
.btn-main{border:none;cursor:pointer;}
.btn-main:hover{transform:translateY(-2px);box-shadow:0 12px 36px rgba(46,125,209,0.32);}
.btn-ghost{display:inline-flex;align-items:center;gap:0.4rem;padding:1rem 2.2rem;border-radius:3px;text-decoration:none;font-size:0.84rem;font-weight:400;letter-spacing:0.08em;text-transform:uppercase;border:1px solid rgba(27,79,140,0.2);color:#111827;background:rgba(255,255,255,0.8);backdrop-filter:blur(8px);transition:border-color 0.2s,transform 0.2s;}
.btn-ghost:hover{border-color:#2E7DD1;transform:translateY(-2px);}
.lsection{padding:6rem 2rem;}
.linner{max-width:1060px;margin:0 auto;}
.ltag{font-size:0.68rem;letter-spacing:0.32em;text-transform:uppercase;color:#C2527A;margin-bottom:0.7rem;font-weight:500;}
.ltitle{font-family:'Playfair Display',serif;font-size:clamp(2rem,4.5vw,3.2rem);font-weight:300;line-height:1.2;margin-bottom:0.9rem;}
.ltitle em{font-style:italic;}
.lsub{font-size:0.95rem;font-weight:300;color:#6B7280;line-height:1.8;max-width:520px;margin-bottom:0;}
.hiw-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));margin-top:3rem;border:1px solid rgba(0,0,0,0.07);}
.hiw-card{padding:2.4rem 1.8rem;background:#fff;border-right:1px solid rgba(0,0,0,0.07);position:relative;overflow:hidden;transition:background 0.3s;}
.hiw-card:last-child{border-right:none;}
.hiw-card::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#2E7DD1,#C2527A);transform:scaleX(0);transform-origin:left;transition:transform 0.35s ease;}
.hiw-card:hover::after{transform:scaleX(1);}
.hiw-who{font-size:0.62rem;letter-spacing:0.28em;text-transform:uppercase;font-weight:600;margin-bottom:0.8rem;padding:0.28rem 0.7rem;border-radius:20px;display:inline-block;}
.wc-you{background:rgba(27,79,140,0.1);color:#1B4F8C;}
.wc-doc{background:rgba(194,82,122,0.1);color:#C2527A;}
.wc-us{background:rgba(184,150,46,0.12);color:#B8962E;}
.wc-all{background:rgba(0,0,0,0.04);color:#111827;}
.hiw-num{font-family:'Playfair Display',serif;font-size:4rem;font-weight:300;color:rgba(0,0,0,0.06);margin:0.5rem 0;}
.hiw-title{font-size:1rem;font-weight:600;margin-bottom:0.5rem;}
.hiw-desc{font-size:0.84rem;color:#6B7280;line-height:1.7;font-weight:300;}
.feat-bg{background:linear-gradient(160deg,#F2F7FD 0%,#FDF0F6 50%,#F2F7FD 100%);padding:6rem 2rem;}
.feat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.2rem;margin-top:3rem;}
.feat-card{background:rgba(255,255,255,0.75);border:1px solid rgba(255,255,255,0.95);border-radius:10px;padding:2.2rem;backdrop-filter:blur(16px);box-shadow:0 2px 16px rgba(27,79,140,0.05);transition:transform 0.3s,box-shadow 0.3s;}
.feat-card:hover{transform:translateY(-5px);box-shadow:0 16px 48px rgba(27,79,140,0.1);}
.feat-title{font-size:0.95rem;font-weight:600;margin-bottom:0.4rem;}
.feat-desc{font-size:0.83rem;color:#6B7280;line-height:1.7;font-weight:300;}
.price-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:1.5rem;align-items:start;max-width:900px;margin:3.5rem auto 0;}
.pc{border-radius:10px;padding:2.4rem 2rem;transition:transform 0.3s;}
.pc:hover{transform:translateY(-4px);}
.pc-free{background:#fff;border:1px solid rgba(0,0,0,0.1);box-shadow:0 2px 16px rgba(0,0,0,0.04);}
.pc-prem{background:linear-gradient(160deg,#1B4F8C 0%,#0E2D60 100%);border:1px solid rgba(255,255,255,0.08);box-shadow:0 20px 60px rgba(27,79,140,0.35);transform:scale(1.04);}
.pc-prem:hover{transform:scale(1.04) translateY(-4px);}
.pc-cust{background:linear-gradient(160deg,#18100A 0%,#2D1A0A 100%);border:1px solid rgba(184,150,46,0.22);box-shadow:0 16px 48px rgba(0,0,0,0.2);}
.pc-badge{display:inline-block;margin-bottom:1.2rem;font-size:0.62rem;letter-spacing:0.28em;text-transform:uppercase;padding:0.3rem 0.85rem;border-radius:20px;font-weight:500;}
.bc-free{background:#D6EAFE;color:#1B4F8C;}.bc-pop{background:linear-gradient(135deg,#E07FAA,#2E7DD1);color:white;}.bc-gold{background:rgba(184,150,46,0.18);color:#E8D18A;}
.pc-name{font-size:1.05rem;font-weight:500;margin-bottom:0.5rem;}.pn-dark{color:white;}
.pc-desc{font-size:0.8rem;margin-bottom:1.6rem;line-height:1.6;}
.d-light{color:#6B7280;}.d-dark{color:rgba(255,255,255,0.55);}.d-gold{color:rgba(184,150,46,0.7);}
.pc-price{font-family:'Playfair Display',serif;font-weight:300;margin-bottom:1.4rem;}
.pc-curr{font-size:1.6rem;vertical-align:super;}.pc-amount{font-size:3.5rem;line-height:1;}.pc-per{font-size:0.78rem;font-family:'Plus Jakarta Sans',sans-serif;opacity:0.5;}
.pc-price-dark{color:white;}.pc-price-gold{color:#E8D18A;}
.pc-div{height:1px;margin:1.4rem 0;}
.dv-light{background:rgba(0,0,0,0.08);}.dv-dark{background:rgba(255,255,255,0.1);}.dv-gold{background:linear-gradient(90deg,transparent,rgba(184,150,46,0.5),transparent);}
.pc-feats{list-style:none;margin-bottom:1.8rem;}
.pc-feats li{font-size:0.84rem;padding:0.42rem 0;display:flex;align-items:flex-start;gap:0.6rem;line-height:1.5;}
.fl{color:#6B7280;}.fd{color:rgba(255,255,255,0.7);}.fg{color:rgba(184,150,46,0.8);}
.ck-b{color:#2E7DD1;font-size:0.75rem;margin-top:2px;}.ck-w{color:rgba(255,255,255,0.7);font-size:0.75rem;margin-top:2px;}.ck-g{color:#B8962E;font-size:0.75rem;margin-top:2px;}
.pc-btn{width:100%;padding:0.9rem;border:none;border-radius:4px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;font-size:0.8rem;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;transition:transform 0.2s;}
.pc-btn:hover{transform:translateY(-2px);}
.btn-bp{background:linear-gradient(135deg,#2E7DD1,#C2527A);color:white;}.btn-wg{background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.2);}.btn-gd{background:linear-gradient(135deg,#B8962E,#E8D18A);color:#111827;}
.testi-bg{background:#F9F8F6;padding:6rem 2rem;}
.testi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.2rem;margin-top:3rem;}
.testi-card{background:#fff;padding:2rem 1.8rem;border-radius:8px;border:1px solid rgba(0,0,0,0.06);box-shadow:0 2px 12px rgba(0,0,0,0.04);transition:box-shadow 0.3s,transform 0.3s;}
.testi-card:hover{box-shadow:0 10px 32px rgba(27,79,140,0.1);transform:translateY(-3px);}
.testi-stars{color:#B8962E;font-size:0.85rem;letter-spacing:0.1em;margin-bottom:1rem;}
.testi-q{font-family:'Playfair Display',serif;font-size:1.05rem;font-style:italic;line-height:1.65;color:#111827;margin-bottom:1.2rem;}
.cta-section{padding:7rem 2rem;text-align:center;background:linear-gradient(135deg,#1B4F8C 0%,#12204A 50%,#C2527A 100%);position:relative;overflow:hidden;}
.cta-section::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 80% at 20% 50%,rgba(130,184,232,0.14),transparent),radial-gradient(ellipse 55% 75% at 80% 50%,rgba(242,184,207,0.12),transparent);}
.cta-inner{position:relative;z-index:2;}
.cta-title{font-family:'Playfair Display',serif;font-size:clamp(2.2rem,4.5vw,3.6rem);font-weight:300;color:white;margin-bottom:1rem;line-height:1.2;}
.cta-title em{font-style:italic;}
.cta-sub{font-size:0.95rem;font-weight:300;color:rgba(255,255,255,0.55);margin-bottom:0.4rem;line-height:1.8;}
.cta-sub2{font-size:0.85rem;color:rgba(255,255,255,0.35);margin-bottom:2.4rem;font-style:italic;}
.cta-btn{display:inline-flex;align-items:center;gap:0.5rem;padding:1.1rem 2.8rem;border-radius:3px;text-decoration:none;font-size:0.82rem;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;background:white;color:#1B4F8C;box-shadow:0 8px 28px rgba(0,0,0,0.2);transition:transform 0.22s;}
.cta-btn{border:none;cursor:pointer;}
.cta-btn:hover{transform:translateY(-2px);}
.cta-box{margin:3rem auto 0;max-width:680px;padding:2rem;background:rgba(255,255,255,0.06);border-radius:8px;border:1px solid rgba(255,255,255,0.1);}
.cta-box p{font-size:0.88rem;color:rgba(255,255,255,0.55);line-height:1.9;font-weight:300;}
.cta-box em{color:rgba(255,255,255,0.75);font-style:italic;}
footer{background:#111827;padding:4rem 2rem 2rem;}
.footer-top{max-width:1060px;margin:0 auto;display:flex;flex-wrap:wrap;gap:3rem;justify-content:space-between;margin-bottom:3rem;}
.footer-logo{font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:400;color:white;margin-bottom:0.3rem;}
.footer-tag{font-size:0.65rem;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:0.8rem;}
.footer-copy{font-size:0.82rem;color:rgba(255,255,255,0.35);line-height:1.7;max-width:210px;}
.fc-title{font-size:0.65rem;letter-spacing:0.25em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:1rem;}
.fc-links{list-style:none;}
.fc-links li{margin-bottom:0.5rem;}
.fc-links a{font-size:0.84rem;color:rgba(255,255,255,0.5);text-decoration:none;transition:color 0.2s;}
.fc-links a:hover{color:rgba(255,255,255,0.9);}
.footer-bottom{max-width:1060px;margin:0 auto;padding-top:1.8rem;border-top:1px solid rgba(255,255,255,0.07);display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;font-size:0.74rem;color:rgba(255,255,255,0.28);}
@media(max-width:768px){.nav-links{display:none;}.pc-prem{transform:none;}.pc-prem:hover{transform:translateY(-4px);}}
/* ── Hero Redesign ── */
.hero-section{min-height:100vh;display:flex;align-items:center;padding:5rem 2rem 3rem;position:relative;overflow:hidden;background:url('/images/hero-bg.png') center/cover no-repeat;}
.hero-overlay{position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,182,214,0.45) 0%,rgba(196,225,255,0.45) 100%);z-index:1;}
.balloons-wrap{position:absolute;inset:0;z-index:2;pointer-events:none;}
.balloon{position:absolute;animation:balloonFloat 4s ease-in-out infinite alternate;}
@keyframes balloonFloat{from{transform:translateY(0) rotate(-4deg)}to{transform:translateY(-22px) rotate(4deg)}}
.hero-content{position:relative;z-index:3;display:grid;grid-template-columns:1fr 1.6fr;gap:3rem;align-items:center;max-width:1400px;margin:0 auto;width:100%;}
.hero-left{display:flex;flex-direction:column;align-items:center;text-align:center;gap:0;}
.hero-title-new{line-height:1.05;margin-bottom:1.2rem;}
.ht-virtual{font-family:'Nunito',sans-serif;font-size:clamp(3rem,6vw,5.5rem);font-weight:900;color:#E8449A;display:block;letter-spacing:-0.01em;}
.ht-gender{font-family:'Nunito',sans-serif;font-size:clamp(2.2rem,4.5vw,4rem);font-weight:900;color:#7B3FC4;display:block;letter-spacing:-0.01em;}
.ht-party{font-family:'Nunito',sans-serif;font-size:clamp(2.5rem,5vw,4.5rem);font-weight:900;color:#3A9FE8;display:block;letter-spacing:-0.01em;}
.hero-sub-new{font-size:1.05rem;color:#333;line-height:1.65;margin-bottom:1.8rem;font-weight:400;}
.btn-create-party{display:inline-flex;align-items:center;gap:0.5rem;padding:1rem 2.4rem;border-radius:50px;border:none;cursor:pointer;font-family:'Nunito',sans-serif;font-size:1.05rem;font-weight:800;background:linear-gradient(135deg,#E8449A,#FF7EC8);color:white;box-shadow:0 6px 24px rgba(232,68,154,0.4);transition:transform 0.2s,box-shadow 0.2s;margin-bottom:1rem;}
.btn-create-party:hover{transform:translateY(-3px);box-shadow:0 10px 32px rgba(232,68,154,0.5);}
.hero-tagline{font-size:1rem;color:#444;font-weight:600;display:flex;align-items:center;gap:0.4rem;}
.hero-right{display:flex;justify-content:center;align-items:center;}
.hero-card-mock{background:white;border-radius:28px;padding:2.4rem 2rem 1.6rem;box-shadow:0 24px 64px rgba(100,60,160,0.22);text-align:center;width:50vw;width:100%;}
.mock-logo-circle{width:120px;height:120px;border-radius:50%;background:linear-gradient(135deg,#FFB8D8 0%,#B8D8FF 100%);margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;font-size:3.2rem;box-shadow:0 8px 24px rgba(180,100,200,0.2);}
.mock-gr-letters{font-family:'Nunito',sans-serif;font-size:3.2rem;font-weight:900;line-height:1;margin-bottom:0.5rem;}
.mock-brand-line{font-size:0.75rem;letter-spacing:0.35em;color:#aaa;font-weight:400;margin-bottom:0.15rem;}
.mock-brand-name{font-size:0.8rem;letter-spacing:0.2em;background:linear-gradient(135deg,#E8449A,#3A9FE8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:700;}
.mock-divider{height:1px;background:#eee;margin:1.2rem 0 1rem;}
.mock-controls{display:flex;justify-content:center;gap:0.9rem;}
.mock-ctrl{width:40px;height:40px;border-radius:50%;background:#f4f4f4;display:flex;align-items:center;justify-content:center;font-size:1.1rem;}
.mock-ctrl-end{background:#FF4E6A;}
/* ── How It Works Redesign ── */
.hiw-new-section{padding:6rem 2rem;position:relative;overflow:hidden;background:url('/images/how-it-works-bg.png') center/cover no-repeat;min-height:90vh;display:flex;align-items:center;justify-content:center;}
.hiw-overlay{position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.18);z-index:2;}
.hiw-new-inner{max-width:1060px;margin:0 auto;position:relative;z-index:3;background:transparent;box-shadow:none;border-radius:0;padding:0;width:100%;}
.hiw-new-header{display:flex;align-items:center;justify-content:center;gap:1rem;margin-bottom:3.5rem;}
.hiw-sparkle{font-size:1.8rem;}
.hiw-main-title{font-family:'Nunito',sans-serif;font-size:clamp(2.2rem,4vw,3.2rem);font-weight:900;text-align:center;background:linear-gradient(90deg,#E8449A,#3A9FE8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-shadow:0 2px 10px rgba(0,0,0,0.1);}
.hiw-cards-row{display:grid;grid-template-columns:repeat(4,1fr);gap:1.2rem;margin-bottom:3rem;position:relative;align-items:stretch;}
.hiw-new-card{display:flex;flex-direction:column;align-items:center;text-align:center;padding:2.2rem 1.4rem 1.8rem;position:relative;background:rgba(255,255,255,0.65);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-radius:24px;transition:transform 0.25s,box-shadow 0.25s;}
.hiw-new-card:hover{transform:translateY(-6px);box-shadow:0 12px 36px rgba(100,60,200,0.12);}
.hiw-new-card::after{display:none !important;}
.hiw-num-circle{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Nunito',sans-serif;font-size:1.2rem;font-weight:900;color:white;margin:0 auto 1.2rem;box-shadow:0 4px 14px rgba(0,0,0,0.15);}
.hnc-1{background:linear-gradient(135deg,#E8449A,#FF7EC8);}.hnc-2{background:linear-gradient(135deg,#3A9FE8,#7EC8FF);}.hnc-3{background:linear-gradient(135deg,#7B6EE8,#B09CFF);}.hnc-4{background:linear-gradient(135deg,#E8449A,#FF7EC8);}
.hiw-icon-bubble{width:76px;height:76px;border-radius:50%;margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;}
.hib-1{background:rgba(232,68,154,0.1);}.hib-2{background:rgba(58,159,232,0.1);}.hib-3{background:rgba(123,110,232,0.1);}.hib-4{background:rgba(232,68,154,0.1);}
.hiw-card-img{width:140px;height:140px;object-fit:contain;margin:0 auto 1.2rem;display:block;}
.hiw-card-title{font-family:'Nunito',sans-serif;font-size:1.1rem;font-weight:800;margin-bottom:0.5rem;}
.hct-1{color:#E8449A;}.hct-2{color:#3A9FE8;}.hct-3{color:#7B6EE8;}.hct-4{color:#E8449A;}
.hiw-card-desc{font-size:0.84rem;color:#374151;line-height:1.7;font-weight:600;flex-grow:1;}
.hiw-feat-bar{background:rgba(255,255,255,0.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.4);border-radius:24px;padding:1.4rem 2.5rem;display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:0;box-shadow:0 8px 32px rgba(0,0,0,0.04);}
.hiw-feat-item{display:flex;align-items:center;gap:0.8rem;}
.hiw-feat-icon{width:40px;height:40px;border-radius:50%;background:rgba(232,68,154,0.2);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;}
.hiw-feat-icon.blue{background:rgba(58,159,232,0.2);}.hiw-feat-icon.purple{background:rgba(123,110,232,0.2);}.hiw-feat-icon.green{background:rgba(58,200,120,0.2);}
.hiw-feat-text{display:flex;flex-direction:column;gap:0.15rem;}
.hiw-feat-text strong{font-family:'Nunito',sans-serif;font-size:0.88rem;font-weight:800;color:#111827;}
.hiw-feat-text span{font-size:0.73rem;color:#4b5563;}
@media(max-width:900px){.hiw-cards-row{grid-template-columns:repeat(2,1fr);}.hiw-new-card:nth-child(2)::after,.hiw-new-card:nth-child(4)::after{display:none;}.hiw-feat-bar{grid-template-columns:repeat(2,1fr);}}
@media(max-width:640px){.hero-content{grid-template-columns:1fr;}.hero-right{display:none;}.hiw-cards-row{grid-template-columns:1fr 1fr;}.hiw-new-card::after{display:none;}.hiw-feat-bar{grid-template-columns:1fr 1fr;}}
/* ── Navbar Redesign ── */
nav#main-nav{position:fixed;top:1rem;left:50%;transform:translateX(-50%);width:calc(100% - 3rem);max-width:980px;height:70px;display:flex;align-items:center;justify-content:space-between;padding:0 1.8rem;background:rgba(255,255,255,0.96);backdrop-filter:blur(20px);border-radius:50px;box-shadow:0 4px 20px rgba(0,0,0,0.1);border:1px solid rgba(255,255,255,0.9);transition:box-shadow 0.3s;}
nav#main-nav.solid{box-shadow:0 6px 28px rgba(0,0,0,0.14);}
.nav-logo{display:flex;align-items:center;gap:0.4rem;text-decoration:none;}
.nav-logo-img{width:56px;height:44px;object-fit:contain;display:block;}
.nav-logo-text{font-family:'Nunito',sans-serif;font-size:1.5rem;font-weight:900;color:#E8449A;line-height:1;}
.nav-links{display:flex;gap:0.6rem;align-items:center;}
.nav-link{font-family:'Plus Jakarta Sans',sans-serif;font-size:0.88rem;font-weight:600;text-decoration:none;color:#555;padding:0.42rem 1.1rem;border-radius:50px;transition:color 0.2s,background 0.2s;background:none;border:none;cursor:pointer;line-height:1;}
.nav-link:hover{color:#E8449A;background:rgba(232,68,154,0.07);}
.nav-link-active{color:#E8449A !important;background:rgba(232,68,154,0.1);}
.nav-right{display:flex;align-items:center;gap:0.7rem;}
.nav-login-btn{display:inline-flex;align-items:center;gap:0.4rem;padding:0.5rem 1.3rem;border-radius:50px;background:#3A9FE8;color:white !important;font-family:'Nunito',sans-serif;font-size:0.86rem;font-weight:700;text-decoration:none;transition:background 0.2s,transform 0.2s;}
.nav-login-btn:hover{background:#2E8AD4;transform:translateY(-1px);}
@media(max-width:768px){nav#main-nav{width:calc(100% - 2rem);padding:0 1rem;}.nav-links{display:none;}.nav-login-btn{padding:0.45rem 1rem;font-size:0.8rem;}}
/* ── Pricing Redesign ── */
.pricing-section{padding:5rem 2rem 5rem;position:relative;overflow:hidden;background:url('/images/pricing-bg.png') center/cover no-repeat;min-height:85vh;display:flex;align-items:center;justify-content:center;}
.pricing-bg-dec{position:absolute;font-size:5rem;line-height:1.3;pointer-events:none;opacity:0.7;animation:balloonFloat 5s ease-in-out infinite alternate;}
.pricing-bg-left{left:1%;top:8%;animation-direction:alternate;}
.pricing-bg-right{right:1%;top:10%;font-size:7rem;animation-direction:alternate-reverse;}
.pricing-inner{max-width:1020px;margin:0 auto;position:relative;z-index:2;width:100%;}
.pricing-header{text-align:center;margin-bottom:1.5rem;}
.pricing-pill-badge{display:inline-flex;align-items:center;gap:0.4rem;padding:0.38rem 1.2rem;border:1.5px solid #B07EE8;border-radius:50px;font-size:0.72rem;font-weight:600;color:#7B4FC4;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:1.2rem;}
.pricing-main-title{margin-bottom:0.7rem;}
.pricing-title-line1{font-family:'Nunito',sans-serif;font-size:clamp(2rem,5vw,3.2rem);font-weight:900;color:#111827;display:block;line-height:1.1;}
.pricing-title-line2{font-family:'Nunito',sans-serif;font-size:clamp(2rem,5vw,3.2rem);font-weight:900;display:block;line-height:1.1;background:linear-gradient(90deg,#E8449A,#3A9FE8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.pricing-sub{font-size:1rem;color:#555;line-height:1.6;}
.pricing-grid{display:grid;grid-template-columns:repeat(2,1fr);max-w-[720px];margin:0 auto 2rem;gap:1.5rem;align-items:stretch;}
.pnew-card{display:flex;flex-direction:column;background:rgba(255,255,255,0.22);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-radius:32px;border:1px solid rgba(255,255,255,0.35);padding:2.4rem 1.8rem 2rem;position:relative;transition:transform 0.25s,box-shadow 0.25s;text-align:center;box-shadow:inset 0 0 12px rgba(255,255,255,0.3), 0 8px 32px rgba(0,0,0,0.05);}
.pnew-basic{box-shadow:inset 0 0 12px rgba(255,255,255,0.35), 0 8px 32px rgba(232,68,154,0.06), 0 0 15px rgba(232,68,154,0.04); border:1px solid rgba(255,255,255,0.35);}
.pnew-basic:hover{transform:translateY(-4px);box-shadow:inset 0 0 16px rgba(255,255,255,0.45), 0 12px 36px rgba(232,68,154,0.15), 0 0 20px rgba(232,68,154,0.1);}
.pnew-premium{transform:scale(1.02);box-shadow:inset 0 0 16px rgba(255,255,255,0.4), 0 15px 45px rgba(100,80,220,0.2), 0 0 25px rgba(58,159,232,0.15); border:1px solid rgba(255,255,255,0.45);}
.pnew-premium:hover{transform:scale(1.02) translateY(-4px);box-shadow:inset 0 0 20px rgba(255,255,255,0.5), 0 20px 56px rgba(100,80,220,0.3), 0 0 35px rgba(58,159,232,0.25);}
.pnew-custom{border:2px solid #A8D8F8;box-shadow:0 8px 32px rgba(58,159,232,0.1);}
.pnew-popular-badge{position:absolute;top:-15px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#E8449A,#FF7EC8);color:white;font-family:'Nunito',sans-serif;font-size:0.72rem;font-weight:800;padding:0.34rem 1.1rem;border-radius:50px;white-space:nowrap;display:flex;align-items:center;gap:0.35rem;box-shadow:0 4px 12px rgba(232,68,154,0.4);}
.pnew-icon-circle{width:68px;height:68px;border-radius:50%;margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;font-size:2rem;}
.pic-pink{background:rgba(232,68,154,0.1);}.pic-purple{background:rgba(123,110,232,0.1);}.pic-blue{background:rgba(58,159,232,0.1);}
.pnew-name{font-family:'Nunito',sans-serif;font-size:1.5rem;font-weight:900;margin-bottom:0.4rem;color:#111827;}
.pn-pink{color:#E8449A;}.pn-blue{color:#3A9FE8;}
.pnew-desc{font-size:0.84rem;color:#374151;line-height:1.55;margin-bottom:1.2rem;font-weight:600;}
.pnew-price{text-align:center;margin-bottom:0.2rem;}
.pnew-price-main{font-family:'Nunito',sans-serif;font-weight:900;line-height:1;}
.pp-pink{color:#E8449A;}.pp-blue{color:#3A9FE8;}
.pnew-price-curr{font-size:1.8rem;vertical-align:super;line-height:1;}
.pnew-price-amt{font-size:4rem;line-height:1;}
.pnew-price-sub{font-size:0.76rem;color:#4b5563;margin-bottom:1.4rem;font-weight:600;}
.pnew-divider{height:1px;background:#f2f2f2;margin:1.2rem 0;}
.pnew-feats{list-style:none;margin-bottom:1.8rem;text-align:left;flex-grow:1;}
.pnew-feats li{font-size:0.84rem;color:#1f2937;padding:0.35rem 0;display:flex;align-items:flex-start;gap:0.6rem;line-height:1.45;font-weight:600;}
.pnew-check-pink{color:#E8449A;font-weight:800;flex-shrink:0;}.pnew-check-blue{color:#3A9FE8;font-weight:800;flex-shrink:0;}
.pnew-btn{width:100%;padding:0.95rem;border:none;border-radius:50px;cursor:pointer;font-family:'Nunito',sans-serif;font-size:1rem;font-weight:800;transition:transform 0.25s,box-shadow 0.25s,opacity 0.2s;}
.pnew-btn:hover{transform:translateY(-2.5px);box-shadow:0 8px 24px rgba(232,68,154,0.5);opacity:0.95;}
.pbtn-pink{background:linear-gradient(135deg,#E8449A,#FF7EC8);color:white;box-shadow:0 4px 16px rgba(232,68,154,0.35);}
.pbtn-gradient{background:linear-gradient(135deg,#E8449A,#3A9FE8);color:white;box-shadow:0 4px 20px rgba(100,80,220,0.3);}
.pbtn-gradient:hover{box-shadow:0 8px 28px rgba(100,80,220,0.45) !important;}
.pbtn-blue{background:linear-gradient(135deg,#3A9FE8,#7EC8FF);color:white;box-shadow:0 4px 16px rgba(58,159,232,0.35);}
.pricing-trust{display:flex;align-items:center;justify-content:center;gap:1.2rem;background:white;border-radius:16px;padding:1rem 2rem;box-shadow:0 4px 16px rgba(0,0,0,0.06);font-size:0.85rem;color:#555;flex-wrap:wrap;}
.pricing-trust-divider{width:1px;height:20px;background:#e0e0e0;}
@media(max-width:768px){.pricing-grid{grid-template-columns:1fr;}.pnew-premium{transform:none;}.pnew-premium:hover{transform:translateY(-6px);}}
/* ── Testimonials Redesign ── */
.testi-new-section{padding:5rem 2rem 2rem;background:url('/images/testimonials-bg.png') center/cover no-repeat;position:relative;overflow:hidden;}
.testi-heart-left{position:absolute;left:2%;top:12%;font-size:5rem;pointer-events:none;animation:balloonFloat 5s ease-in-out infinite alternate;opacity:0.7;}
.testi-heart-right{position:absolute;right:2%;top:18%;font-size:4.5rem;pointer-events:none;animation:balloonFloat 4.5s ease-in-out infinite alternate-reverse;opacity:0.6;}
.testi-new-inner{max-width:1220px;margin:0 auto;position:relative;z-index:2;}
.testi-new-header{text-align:center;margin-bottom:3rem;}
.testi-pill-badge{display:inline-flex;align-items:center;gap:0.4rem;padding:0.38rem 1.2rem;border:1.5px solid #E8449A;border-radius:50px;font-size:0.72rem;font-weight:600;color:#E8449A;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:1.2rem;}
.testi-main-title{font-family:'Nunito',sans-serif;font-size:clamp(2rem,4.5vw,2.8rem);font-weight:900;color:#1a1a2e;line-height:1.15;}
.testi-title-pink{color:#E8449A;}
.testi-new-sub{font-size:0.95rem;color:#888;margin-top:0.6rem;}
.testi-new-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1.5rem;margin-bottom:3rem;}
@media(max-width:1024px){.testi-new-grid{grid-template-columns:repeat(2,1fr);}}
@media(max-width:640px){.testi-new-grid{grid-template-columns:1fr;}}
.testi-new-card{background:rgba(255,255,255,0.25);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border-radius:20px;padding:1.4rem 1.3rem;box-shadow:0 8px 32px rgba(0,0,0,0.04);border:1px solid rgba(255,255,255,0.18);position:relative;transition:all 0.3s ease;opacity:0.85;}
.testi-new-card:hover{transform:translateY(-5px);box-shadow:0 12px 36px rgba(100,60,200,0.15);background:rgba(255,255,255,0.7);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.45);opacity:1;}
.testi-avatar-placeholder{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#FFB8D8,#B8D8FF);display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:0.7rem;}
.testi-new-stars{font-size:0.9rem;margin-bottom:0.6rem;letter-spacing:0.05em;}
.testi-stars-pink{color:#E8449A;}.testi-stars-purple{color:#7B6EE8;}.testi-stars-blue{color:#3A9FE8;}
.testi-new-title{font-family:'Nunito',sans-serif;font-size:0.86rem;font-weight:900;color:#1a1a2e;margin-bottom:0.4rem;line-height:1.25;}
.testi-new-q{font-size:0.78rem;color:#444;line-height:1.6;margin-bottom:0.9rem;font-style:italic;}
.testi-new-name{font-family:'Nunito',sans-serif;font-size:0.86rem;font-weight:800;}
.tn-pink{color:#E8449A;}.tn-blue{color:#3A9FE8;}.tn-purple{color:#7B6EE8;}
.testi-new-role{font-size:0.7rem;color:#aaa;margin-top:0.15rem;}
.testi-card-heart{position:absolute;bottom:1.2rem;right:1.4rem;font-size:1.2rem;}
.testi-stats-bar{background:#1a2a4a;border-radius:20px;padding:1.6rem 2.5rem;display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:0;}
.testi-stat-item{display:flex;align-items:center;gap:0.8rem;}
.testi-stat-icon{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;}
.tsi-pink{background:rgba(232,68,154,0.2);}.tsi-blue{background:rgba(58,159,232,0.2);}.tsi-purple{background:rgba(123,110,232,0.2);}.tsi-gold{background:rgba(255,180,50,0.2);}
.testi-stat-text{display:flex;flex-direction:column;gap:0.1rem;}
.testi-stat-text strong{font-family:'Nunito',sans-serif;font-size:1.05rem;font-weight:900;color:white;}
.testi-stat-text span{font-size:0.72rem;color:rgba(255,255,255,0.55);}
@media(max-width:768px){.testi-new-grid{grid-template-columns:1fr;}.testi-stats-bar{grid-template-columns:repeat(2,1fr);}.pricing-trust{gap:0.8rem;font-size:0.78rem;}}
/* ── How It Works section color ── */
/* hiw-new-section background overridden */
/* hiw-new-inner background overridden */
.hiw-new-card:nth-child(1){border:1px solid rgba(255,184,216,0.5);box-shadow:0 8px 32px rgba(232,68,154,0.08),0 0 15px rgba(255,255,255,0.1);}
.hiw-new-card:nth-child(2){border:1px solid rgba(176,212,255,0.5);box-shadow:0 8px 32px rgba(58,159,232,0.08),0 0 15px rgba(255,255,255,0.1);}
.hiw-new-card:nth-child(3){border:1px solid rgba(200,184,255,0.5);box-shadow:0 8px 32px rgba(123,110,232,0.08),0 0 15px rgba(255,255,255,0.1);}
.hiw-new-card:nth-child(4){border:1px solid rgba(255,184,216,0.5);box-shadow:0 8px 32px rgba(232,68,154,0.08),0 0 15px rgba(255,255,255,0.1);}
.hiw-new-card:nth-child(1):hover{transform:translateY(-4px);box-shadow:0 12px 36px rgba(232,68,154,0.2),0 0 20px rgba(255,255,255,0.2);}
.hiw-new-card:nth-child(2):hover{transform:translateY(-4px);box-shadow:0 12px 36px rgba(58,159,232,0.2),0 0 20px rgba(255,255,255,0.2);}
.hiw-new-card:nth-child(3):hover{transform:translateY(-4px);box-shadow:0 12px 36px rgba(123,110,232,0.2),0 0 20px rgba(255,255,255,0.2);}
.hiw-new-card:nth-child(4):hover{transform:translateY(-4px);box-shadow:0 12px 36px rgba(232,68,154,0.2),0 0 20px rgba(255,255,255,0.2);}
/* Legacy hiw-feat overrides commented out to enable full glassmorphism */
/*
.hiw-feat-bar{background:linear-gradient(135deg,#FFE8F4 0%,#EDE8FF 50%,#E8F4FF 100%);border:1px solid rgba(232,68,154,0.12);box-shadow:0 4px 24px rgba(100,60,200,0.07);padding:1.8rem 2.8rem;}
.hiw-feat-item{gap:1rem;}
.hiw-feat-icon{width:48px;height:48px;font-size:1.4rem;background:rgba(255,110,180,0.12);box-shadow:0 0 0 1.5px rgba(255,110,180,0.2);}
.hiw-feat-icon.blue{background:rgba(77,168,232,0.12);box-shadow:0 0 0 1.5px rgba(77,168,232,0.2);}
.hiw-feat-icon.purple{background:rgba(123,110,232,0.12);box-shadow:0 0 0 1.5px rgba(123,110,232,0.2);}
.hiw-feat-icon.green{background:rgba(72,200,136,0.12);box-shadow:0 0 0 1.5px rgba(72,200,136,0.2);}
.hiw-feat-text strong{font-size:0.92rem;font-weight:800;color:#1a1a2e;}
.hiw-feat-text span{font-size:0.75rem;color:#888;}
*/
/* ── Testi stats-bar light override ── */
.testi-stats-bar{background:rgba(255,255,255,0.4);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.3);box-shadow:0 8px 32px rgba(0,0,0,0.05);}
.tsi-pink{background:rgba(232,68,154,0.12);box-shadow:0 0 0 1.5px rgba(232,68,154,0.2);}
.tsi-blue{background:rgba(58,159,232,0.12);box-shadow:0 0 0 1.5px rgba(58,159,232,0.2);}
.tsi-purple{background:rgba(123,110,232,0.12);box-shadow:0 0 0 1.5px rgba(123,110,232,0.2);}
.tsi-gold{background:rgba(255,180,50,0.12);box-shadow:0 0 0 1.5px rgba(255,180,50,0.2);}
.testi-stat-text strong{color:#1a1a2e;}
.testi-stat-text span{color:#888;}
/* ── CTA Section Redesign ── */
.cta-new-section{padding:6rem 2rem;position:relative;overflow:hidden;background:url('/images/cta-bg.png') center/cover no-repeat;text-align:center;}
.cta-bg-dec{position:absolute;pointer-events:none;font-size:6rem;opacity:0.65;animation:balloonFloat 5s ease-in-out infinite alternate;}
.cta-bg-left{left:3%;top:10%;}
.cta-bg-right{right:3%;top:15%;animation-direction:alternate-reverse;font-size:5rem;}
.cta-new-inner{position:relative;z-index:2;max-width:680px;margin:0 auto;}
.cta-pill-badge{display:inline-flex;align-items:center;gap:0.4rem;padding:0.38rem 1.2rem;border:1.5px solid #E8449A;border-radius:50px;font-size:0.72rem;font-weight:600;color:#E8449A;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:1.4rem;}
.cta-new-title{font-family:'Nunito',sans-serif;font-size:clamp(2.2rem,5vw,3.4rem);font-weight:900;color:#1a1a2e;line-height:1.15;margin-bottom:1rem;}
.cta-title-gradient{background:linear-gradient(90deg,#E8449A,#3A9FE8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;display:block;}
.cta-new-sub{font-size:1rem;color:#555;line-height:1.7;margin-bottom:0.4rem;}
.cta-new-sub2{font-size:0.88rem;color:#888;margin-bottom:2.2rem;font-style:italic;}
.cta-new-btn{display:inline-flex;align-items:center;gap:0.5rem;padding:1rem 2.8rem;border-radius:50px;border:none;cursor:pointer;font-family:'Nunito',sans-serif;font-size:1.05rem;font-weight:800;background:linear-gradient(135deg,#E8449A,#FF7EC8);color:white;box-shadow:0 6px 24px rgba(232,68,154,0.4);transition:transform 0.2s,box-shadow 0.2s;margin-bottom:2.2rem;}
.cta-new-btn:hover{transform:translateY(-3px);box-shadow:0 10px 32px rgba(232,68,154,0.5);}
.cta-new-box{background:white;border-radius:20px;padding:1.8rem 2rem;border:1px solid rgba(232,68,154,0.1);box-shadow:0 4px 20px rgba(100,60,200,0.06);}
.cta-new-box p{font-size:0.88rem;color:#555;line-height:1.85;margin-bottom:0.5rem;}
.cta-new-box p:last-child{margin-bottom:0;}
.cta-new-box em{color:#E8449A;}
/* ── Footer Redesign ── */
.footer-new{background:#fff;border-top:3px solid transparent;border-image:linear-gradient(90deg,#E8449A,#7B6EE8,#3A9FE8) 1;padding:4rem 2rem 2rem;}
.footer-new-inner{max-width:1060px;margin:0 auto;}
.footer-new-top{display:flex;flex-wrap:wrap;gap:3rem;justify-content:space-between;margin-bottom:3rem;}
.footer-brand-col{max-width:220px;}
.footer-logo-new{display:flex;align-items:center;gap:0.35rem;text-decoration:none;margin-bottom:0.4rem;}
.footer-logo-new span:first-child{font-size:1.3rem;}
.footer-logo-text{font-family:'Nunito',sans-serif;font-size:1.5rem;font-weight:900;color:#E8449A;line-height:1;}
.footer-logo-sub{font-family:'Playfair Display',serif;font-size:0.95rem;color:#1a1a2e;margin-bottom:0.2rem;}
.footer-tagline-text{font-size:0.65rem;letter-spacing:0.22em;text-transform:uppercase;color:#E8449A;margin-bottom:0.8rem;font-weight:600;}
.footer-copy-text{font-size:0.82rem;color:#888;line-height:1.7;}
.footer-col-title{font-family:'Nunito',sans-serif;font-size:0.78rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#1a1a2e;margin-bottom:1rem;}
.footer-col-links{list-style:none;}
.footer-col-links li{margin-bottom:0.5rem;}
.footer-col-links a{font-size:0.84rem;color:#888;text-decoration:none;transition:color 0.2s;}
.footer-col-links a:hover{color:#E8449A;}
.footer-new-bottom{padding-top:1.6rem;border-top:1px solid rgba(0,0,0,0.07);display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;font-size:0.74rem;color:#bbb;}
@media(max-width:640px){
  .footer-new-top{flex-direction:column;gap:2rem;}
  .cta-bg-dec{font-size:3.5rem;}
  .faq-modal-content{padding:2rem 1rem !important; max-height: 90vh !important; overflow: hidden !important;}
  .faq-question-btn{padding:1.1rem 1.2rem !important;font-size:0.95rem !important;}
  .faq-answer p{font-size:0.86rem !important;}
  .faq-item.active .faq-answer{padding:0 1.2rem 1.1rem !important;}
}
/* ── Hero card mock — larger ── */
.hero-title-img{width:100%;max-width:480px;height:auto;display:block;margin-bottom:1.2rem;filter:drop-shadow(0 0 18px rgba(255,255,255,0.9)) drop-shadow(0 0 40px rgba(255,255,255,0.5));}
.hero-card-mock{width:100%;max-width:720px;padding:3rem 2.8rem 2.2rem;transform:perspective(1000px) rotateY(-8deg) rotateX(4deg);transition:transform 0.4s ease;}
.hero-card-mock:hover{transform:perspective(1000px) rotateY(-2deg) rotateX(1deg);}
.hero-card-video{padding:0;overflow:hidden;}
.hero-mock-video{width:100%;height:auto;display:block;border-radius:28px;}
.mock-logo-circle{width:170px;height:170px;font-size:4.4rem;}
.mock-gr-letters{font-size:4.4rem;margin-bottom:0.7rem;}
.mock-brand-line{font-size:0.85rem;letter-spacing:0.38em;margin-bottom:0.25rem;}
.mock-brand-name{font-size:0.95rem;letter-spacing:0.22em;}
.mock-divider{margin:1.6rem 0 1.4rem;}
.mock-controls{gap:1.2rem;}
.mock-ctrl{width:52px;height:52px;font-size:1.4rem;}

/* ── Mobile Layout Optimization Overrides ── */
@media(max-width:768px){
  .hiw-new-inner {
    border-radius: 32px !important;
    padding: 2.2rem 1.2rem !important;
  }
  .hiw-cards-row {
    grid-template-columns: 1fr 1fr !important;
    gap: 1.2rem !important;
  }
  .hiw-new-card {
    padding: 1.5rem 1rem !important;
  }
  .hiw-feat-bar {
    padding: 1.5rem 1.2rem !important;
    grid-template-columns: 1fr !important;
    gap: 1.2rem !important;
  }
  .hiw-feat-item {
    justify-content: flex-start !important;
  }
  .pricing-section {
    padding: 4rem 1.2rem 4rem !important;
  }
  .pnew-card {
    padding: 2rem 1.2rem 1.8rem !important;
    border-radius: 28px !important;
  }
  .pricing-trust {
    padding: 1rem !important;
    justify-content: center !important;
    gap: 0.8rem !important;
  }
  .pricing-trust-divider {
    display: none !important;
  }
  .testi-new-section {
    padding: 4rem 1.2rem 2rem !important;
  }
  .testi-stats-bar {
    grid-template-columns: 1fr !important;
    padding: 1.5rem 1.2rem !important;
    gap: 1.2rem !important;
  }
  .testi-new-card {
    padding: 1.8rem 1.2rem !important;
  }
  .cta-new-section {
    padding: 4rem 1.2rem !important;
  }
  .cta-new-box {
    padding: 1.2rem !important;
  }
  .cta-new-btn {
    padding: 0.9rem 2rem !important;
    font-size: 0.95rem !important;
  }
}
@media(max-width:480px){
  .hiw-cards-row {
    grid-template-columns: 1fr !important;
  }
}

/* ── FAQ Modal & Support ── */
.faq-modal-overlay{position:fixed;inset:0;background:rgba(10,10,20,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:2rem;}
.faq-modal-content{width:100%;max-width:840px;max-height:85vh;overflow:hidden;background-image:url('/images/faq-background.png');background-size:cover;background-position:center;border:1.5px solid rgba(255,255,255,0.4);border-radius:24px;padding:3rem 2rem;position:relative;box-shadow:0 20px 50px rgba(0,0,0,0.15);}
.faq-modal-content::before{content:'';position:absolute;inset:0;background:rgba(255,255,255,0.7);z-index:0;border-radius:22px;}
.faq-modal-close{position:absolute;top:20px;right:20px;width:36px;height:36px;border-radius:50%;border:1px solid rgba(0,0,0,0.1);background:white;color:#1a1a2e;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;z-index:10;}
.faq-modal-close:hover{background:#fafafa;transform:scale(1.05);color:#E8449A;}
.cta-support-section{padding:3.5rem 2rem;background:#fafafd;text-align:center;border-top:1px dashed rgba(0,0,0,0.05);}
.cta-support-inner{max-width:720px;margin:0 auto;}
.cta-support-text{font-size:0.95rem;color:#6b7280;line-height:1.7;font-weight:600;}
.cta-support-text a{color:#3A9FE8;text-decoration:none;font-weight:700;}
.cta-support-text a:hover{text-decoration:underline;color:#E8449A;}

.faq-header{text-align:center;margin-bottom:3.5rem;position:relative;z-index:1;}
.faq-badge{display:inline-flex;align-items:center;gap:0.4rem;padding:0.38rem 1.2rem;border:1.5px solid #3A9FE8;border-radius:50px;font-size:0.72rem;font-weight:600;color:#3A9FE8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:1rem;}
.faq-title{font-family:'Nunito',sans-serif;font-size:clamp(2rem,4vw,2.8rem);font-weight:900;color:#1a1a2e;line-height:1.2;margin-bottom:0.8rem;}
.faq-sub{font-size:0.95rem;color:#666;max-width:540px;margin:0 auto;line-height:1.6;}
.faq-list{display:flex;flex-direction:column;gap:1.2rem;position:relative;z-index:1;max-width:720px;margin:0 auto;}
.faq-item{background:rgba(255,255,255,0.45);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.5);border-radius:18px;overflow:hidden;transition:all 0.3s cubic-bezier(0.16, 1, 0.3, 1);box-shadow:0 4px 15px rgba(0,0,0,0.03);}
.faq-item:hover{transform:scale(1.02) translateY(-2px);background:rgba(255,255,255,0.55);border-color:rgba(58,159,232,0.45);box-shadow:0 10px 25px rgba(232,68,154,0.15), 0 10px 25px rgba(58,159,232,0.15);}
.faq-item.active{background:rgba(255,255,255,0.65);border-color:rgba(58,159,232,0.4);box-shadow:0 8px 30px rgba(58,159,232,0.06);}
.faq-question-btn{width:100%;display:flex;align-items:center;justify-content:space-between;padding:1.4rem 1.8rem;border:none;background:transparent;cursor:pointer;text-align:left;font-family:'Plus Jakarta Sans',sans-serif;font-size:1.02rem;font-weight:700;color:#1a1a2e;transition:color 0.2s;}
.faq-question-btn:hover{color:#3A9FE8;}
.faq-icon{font-size:1.2rem;color:#3A9FE8;transition:transform 0.25s;font-weight:bold;}
.faq-item.active .faq-icon{transform:rotate(45deg);color:#E8449A;}
.faq-answer{max-height:0;overflow:hidden;transition:max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1), padding 0.3s;}
.faq-item.active .faq-answer{max-height:500px;padding:0 1.8rem 1.4rem;border-top:1px dashed rgba(229,231,235,0.4);}
.faq-answer p{font-size:0.92rem;color:#444;line-height:1.7;}
@media(max-width:860px){
  .faq-list{grid-template-columns:1fr !important;}
}
`;
