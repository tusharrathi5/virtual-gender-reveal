"use client";
/**
 * CinematicEntry.tsx
 * Step 1 — 6-scene cinematic intro + full landing page
 * Brand: Virtual Gender Reveal
 * Tagline: "Crafted for Moments That Matter"
 */

import { useState, useEffect, useRef } from "react";

// ── Scene durations (ms). 0 = user must click to advance ──
const SCENE_DURATIONS = [3800, 3200, 3200, 4000, 4500, 0];

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
  const [scene, setScene] = useState(0); // 0-5 cinema, 6 = landing
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = () => {
    if (scene + 1 >= 6) {
      setExiting(true);
      setTimeout(() => setScene(6), 1000);
    } else {
      setScene((s) => s + 1);
    }
  };

  useEffect(() => {
    if (scene >= 6) return;
    const dur = SCENE_DURATIONS[scene];
    if (dur === 0) return;
    timerRef.current = setTimeout(advance, dur);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [scene]);

  // Scroll-reveal observer for landing
  useEffect(() => {
    if (scene !== 6) return;
    const timer = setTimeout(() => {
      const obs = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
        { threshold: 0.12 }
      );
      document.querySelectorAll(".fade-up").forEach((el) => obs.observe(el));
      return () => obs.disconnect();
    }, 200);
    return () => clearTimeout(timer);
  }, [scene]);

  // Nav solid on scroll
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
        {scene < 6 && (
  <button
    onClick={() => {
      // Skip directly to landing page
      const landingEl = document.getElementById("landing");
      if (landingEl) {
        landingEl.scrollIntoView({ behavior: "smooth" });
      }
      setScene(6);
    }}
    style={{
      position: "fixed",
      top: 24,
      right: 24,
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 20px",
      background: "rgba(10,6,8,0.6)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: 8,
      color: "rgba(255,255,255,0.7)",
      fontFamily: "'Jost', sans-serif",
      fontSize: 12,
      fontWeight: 400,
      letterSpacing: "2px",
      textTransform: "uppercase",
      cursor: "pointer",
      backdropFilter: "blur(12px)",
      transition: "all 0.2s",
      animation: "fadeInSkip 0.5s ease-out 0.8s both",
    }}
    onMouseOver={e => {
      e.currentTarget.style.background = "rgba(10,6,8,0.85)";
      e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
      e.currentTarget.style.color = "#ffffff";
    }}
    onMouseOut={e => {
      e.currentTarget.style.background = "rgba(10,6,8,0.6)";
      e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
      e.currentTarget.style.color = "rgba(255,255,255,0.7)";
    }}
  >
    Skip intro
    <span style={{ fontSize: 14, lineHeight: 1 }}>→</span>
  </button>
)}

        {/* Scene 1 */}
        {scene === 0 && (
          <div className="scene active">
            <div className="s1-sky" />
            {CLOUDS_S1.map((c, i) => (
              <div key={i} className="cloud" style={{ width: c.w, height: c.h, top: c.top, left: c.left, "--blur": c.blur } as React.CSSProperties} />
            ))}
            <div className="bird-wrap">
              <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
                <ellipse cx="60" cy="52" rx="22" ry="12" fill="white" opacity="0.95" />
                <path d="M10 45 Q35 20 60 52 Q85 20 110 45" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
                <ellipse cx="60" cy="50" rx="8" ry="6" fill="rgba(130,184,232,0.4)" />
              </svg>
            </div>
            <div className="cin-text" style={{ marginTop: "60px" }}>
              <p>"From a place far beyond…<br />a new journey begins."</p>
              <div className="dot-row">◆ &nbsp; ◆ &nbsp; ◆</div>
            </div>
            <SceneProgress current={scene} />
          </div>
        )}

        {/* Scene 2 */}
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
                <div className="bundle-orb bundle-blue">🔵</div>
                <div className="bundle-label">Boy</div>
              </div>
              <div style={{ width: 2, height: 60, background: "linear-gradient(to bottom,transparent,rgba(255,255,255,0.4),transparent)" }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem" }}>
                <div className="bundle-orb bundle-pink">🩷</div>
                <div className="bundle-label">Girl</div>
              </div>
            </div>
            <div className="cin-text"><p>"Two possibilities.<br /><em>One beautiful destiny.</em>"</p></div>
            <SceneProgress current={scene} />
          </div>
        )}

        {/* Scene 3 */}
        {scene === 2 && (
          <div className="scene active">
            <div className="s3-bg" />
            {Array.from({ length: 14 }, (_, i) => (
              <div key={i} className="arena-light" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
            <div style={{ position: "relative", zIndex: 5, width: "90%", maxWidth: 700, animation: "fadeUp 0.8s ease 0.2s both" }}>
              <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,220,150,0.6)" }}>⬡ Grand Reveal Arena ⬡</span>
              </div>
              <div className="track-surface">
                <div className="track-lane" style={{ top: "30%" }} />
                <div className="track-lane" style={{ top: "70%" }} />
                <div className="horse-arrive">🐎 🔵 + 🩷</div>
              </div>
            </div>
            <div className="cin-text" style={{ marginTop: "1.5rem" }}><p><em>"The stage is set. The arena awaits."</em></p></div>
            <SceneProgress current={scene} />
          </div>
        )}

        {/* Scene 4 */}
        {scene === 3 && (
          <div className="scene active">
            <div className="s4-bg" />
            <div className="crowd-dots" />
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
                  {lane.obstacles.map((o, j) => (
                    <div key={j} className="obstacle" style={{ left: o.left, "--oa": o.oa } as React.CSSProperties}>{o.icon}</div>
                  ))}
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

        {/* Scene 5 — Split Reveal */}
        {scene === 4 && (
          <div className="scene active" style={{ flexDirection: "row" }}>
            <div style={{ position: "absolute", inset: 0, display: "flex" }}>
              {/* Blue */}
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
              {/* Pink */}
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

        {/* Scene 6 — Brand */}
        {scene === 5 && (
          <div className="scene active">
            <div className="s1-sky" />
            {CLOUDS_S1.map((c, i) => (
              <div key={i} className="cloud" style={{ width: c.w, height: c.h, top: c.top, left: c.left, "--blur": c.blur } as React.CSSProperties} />
            ))}
            <div className="brand-box">
              <div style={{ fontSize: "3.5rem", marginBottom: "0.8rem", animation: "wordPop 0.7s ease 0.3s both", display: "block" }}>🎀</div>
              <div className="brand-name">
                <span style={{ color: "#1B4F8C" }}>Virtual</span>{" "}
                <span style={{ color: "#E07FAA" }}>Gender</span> Reveal
              </div>
              <div className="brand-tag">Crafted for Moments That Matter</div>
              <button className="enter-btn" onClick={advance}>
                ✦ &nbsp; Enter the Experience
              </button>
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
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={`sp-dot${i === current ? " active" : ""}`} />
      ))}
    </div>
  );
}

// ── Landing Page ────────────────────────────────────────────
function LandingPage() {
  return (
    <>
      <style>{LANDING_CSS}</style>
      <nav id="main-nav">
        <a href="#" className="nav-logo">
          Virtual Gender Reveal
          <strong>Crafted for Moments That Matter</strong>
        </a>
        <div className="nav-links">
          <a href="#how">How It Works</a>
          <a href="#pricing">Pricing</a>
          <a href="#contact">Contact</a>
          <a href="/auth" style={{color:"inherit",textDecoration:"none"}}>Log In</a>
          <a href="/auth" className="nav-cta-btn">Start Your Reveal</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero-section">
        <div className="hero-mesh" />
        <div className="hero-grid-bg" />
        <div className="hero-inner">
          <div className="hero-pill">✦ A Little Magic. A Big Reveal.</div>
          <h1 className="hero-title">
            <em style={{ color: "#1B4F8C" }}>A Little Magic.</em><br />
            <em style={{ color: "#E07FAA" }}>A Big Reveal.</em>
          </h1>
          <p className="hero-sub">Create a cinematic gender reveal and share the moment live with everyone you love — wherever they are.</p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/auth" className="btn-main">✦ Start Your Reveal</a>
            <a href="#pricing" className="btn-ghost">View Plans →</a>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="lsection" id="how">
        <div className="linner">
          <div className="fade-up">
            <div className="ltag">How It Works</div>
            <h2 className="ltitle">Four steps.<br /><em>One perfect moment.</em></h2>
          </div>
          <div className="hiw-grid fade-up">
            {[
              { who: "You", wc: "wc-you", title: "You book. We get to work.", desc: "Tell us your due date, your baby's nickname, and how you want the reveal to feel. That's all we need. Your doctor link goes out within the hour." },
              { who: "Your Doctor", wc: "wc-doc", title: "The secret goes in. It doesn't come out.", desc: "Your doctor or relative clicks a private, one-time secure link. They submit the gender. It's encrypted instantly. You have zero access — not even a hint — until the reveal plays." },
              { who: "Us", wc: "wc-us", title: "We make your reveal video.", desc: "Our team creates a personalized reveal video for your family — your baby's nickname, your names, your story. Cinematic. Emotional. Made for the biggest reaction." },
              { who: "Everyone", wc: "wc-all", title: "Every person. One second. Zero exceptions.", desc: "Your guests get a beautiful personal invitation, join a live virtual party room, and at the exact second you chose — the reveal plays. Phone in New York. Laptop in Texas. TV in Florida." },
            ].map((s, i) => (
              <div className="hiw-card" key={i}>
                <span className={`hiw-who ${s.wc}`}>{s.who}</span>
                <div className="hiw-num">0{i + 1}</div>
                <div className="hiw-title">{s.title}</div>
                <div className="hiw-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="feat-bg" id="features">
        <div className="linner">
          <div className="fade-up">
            <div className="ltag">What Sets Us Apart</div>
            <h2 className="ltitle">Everything your reveal needs.<br /><em>Built in, not bolted on.</em></h2>
            <p className="lsub">Every feature is included in every plan. No add-ons. No surprise charges. No app downloads required.</p>
          </div>
          <div className="feat-grid fade-up">
            {[
              { icon: "🔐", title: "Doctor-Secured Gender Submission", desc: "A private, one-time secure link via email. One click. A simple form. The link deactivates immediately and expires in 7 days." },
              { icon: "📡", title: "Live Broadcast to Every Guest at Once", desc: "At the exact time you set, your reveal streams live to every guest simultaneously — same second, no delay." },
              { icon: "🎉", title: "Virtual Party Room with Live Chat & Polls", desc: "Guests join before the reveal, vote in the Boy or Girl poll, and chat in real time. The party starts early." },
              { icon: "💌", title: "Beautiful Personalized Invitations", desc: "Upload a CSV or add emails manually. We send personalized invitations with a unique secure watch link." },
              { icon: "📅", title: "30-Day Replay Window", desc: "Your reveal stays available for 30 days. A reminder goes out at day 25. On day 30 it's permanently deleted." },
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
          <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
            <a href="#" className="btn-ghost">▶ &nbsp; See Sample Videos</a>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="lsection" id="pricing">
        <div className="linner">
          <div className="fade-up" style={{ textAlign: "center" }}>
            <div className="ltag">Pricing</div>
            <h2 className="ltitle">One payment. One reveal.<br /><em>No surprises.</em></h2>
          </div>
          <div className="price-grid fade-up">
            {[
              { cls: "pc-free", badge: "Free", bc: "bc-free", name: "Free Plan", desc: "Basic reveal setup to get started.", price: "0", pCls: "", dc: "d-light", divCls: "dv-light", feats: ["Basic reveal page", "Doctor secure link", "Up to 20 guests", "Email invitations", "7-day replay"], fCls: "fl", ckCls: "ck-b", btnCls: "btn-bp", btnLabel: "Start Free" },
              { cls: "pc-prem", badge: "Most Popular", bc: "bc-pop", name: "Premium", desc: "Full cinematic + live experience.", price: "199", pCls: "pc-price-dark", dc: "d-dark", divCls: "dv-dark", feats: ["Cinematic reveal video — made by us", "Live virtual party room", "Up to 200 guests", "Live chat & Boy/Girl polls", "Personalized guest invitations", "30-day replay window", "Custom overlay"], fCls: "fd", ckCls: "ck-w", btnCls: "btn-wg", btnLabel: "Go Premium" },
              { cls: "pc-cust", badge: "White Glove", bc: "bc-gold", name: "Custom", desc: "Fully personalized story reveal.", price: "650", pCls: "pc-price-gold", dc: "d-gold", divCls: "dv-gold", feats: ["Bespoke reveal video story", "Unlimited guests", "Dedicated concierge", "Custom soundtrack", "Live on-call support", "Permanent family archive"], fCls: "fg", ckCls: "ck-g", btnCls: "btn-gd", btnLabel: "Create Custom Reveal" },
            ].map((p, i) => (
              <div className={`pc ${p.cls}`} key={i}>
                <span className={`pc-badge ${p.bc}`}>{p.badge}</span>
                <div className={`pc-name${p.pCls ? " pn-dark" : ""}`}>{p.name}</div>
                <div className={`pc-desc ${p.dc}`}>{p.desc}</div>
                <div className={`pc-price ${p.pCls}`}>
                  <span className="pc-curr">$</span>
                  <span className="pc-amount">{p.price}</span>
                  <span className="pc-per"> / reveal</span>
                </div>
                <div className={`pc-div ${p.divCls}`} />
                <ul className="pc-feats">
                  {p.feats.map((f, j) => (
                    <li key={j} className={p.fCls}><span className={p.ckCls}>✓</span>{f}</li>
                  ))}
                </ul>
                <button className={`pc-btn ${p.btnCls}`}>{p.btnLabel}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testi-bg">
        <div className="linner">
          <div className="fade-up" style={{ textAlign: "center" }}>
            <div className="ltag">Testimonials</div>
            <h2 className="ltitle">Moments That <em>Stay Forever</em></h2>
          </div>
          <div className="testi-grid fade-up">
            {[
              { q: '"We had family in three different states watching. Everyone found out at the exact same second. My mom ugly-cried in Florida and I watched it happen live. I will never forget that."', name: "Sarah M.", loc: "Texas", av: "#2E7DD1" },
              { q: '"The doctor link was so easy. She submitted in under a minute. I genuinely had no idea. When the video played and it said girl — I couldn\'t breathe."', name: "Jessica & Tom K.", loc: "New York", av: "#E07FAA" },
              { q: '"My parents are in their 70s. They couldn\'t travel. For the first time they had the actual front-row seat. Not a text an hour later. They were there."', name: "Amanda R.", loc: "California", av: "#B8962E" },
            ].map((t, i) => (
              <div className="testi-card" key={i}>
                <div className="testi-stars">★★★★★</div>
                <div className="testi-q">{t.q}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: t.av, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "0.85rem", fontWeight: 500, flexShrink: 0 }}>{t.name[0]}</div>
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>{t.name}</div>
                    <div style={{ fontSize: "0.74rem", color: "#6B7280" }}>{t.loc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section" id="contact">
        <div className="cta-inner">
          <h2 className="cta-title">Your family is waiting<br /><em>to find out together.</em></h2>
          <p className="cta-sub">Book your reveal today and your doctor link will be ready within the hour.</p>
          <p className="cta-sub2">Grandma in Florida and your best friend in New York will both be there.</p>
          <a href="#pricing" className="cta-btn">✦ Start Your Reveal</a>
          <div className="cta-box">
            <p>Virtual Baby Reveal is designed to make your special moment joyful, seamless, and completely stress-free. Whether your loved ones are nearby or across the world, everyone can be part of your celebration — together, in real time.</p>
            <br />
            <p><em>Because moments like these deserve to be felt together.</em></p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="footer-top">
          <div>
            <div className="footer-logo">Virtual Gender Reveal</div>
            <div className="footer-tag">Crafted for Moments That Matter</div>
            <div className="footer-copy">The world&apos;s most heartfelt virtual gender reveal platform.</div>
          </div>
          {[
            { title: "Platform", links: ["How It Works", "Features", "Pricing", "Sample Videos"] },
            { title: "Support", links: ["Help Centre", "Contact Us", "Doctor Guide", "Privacy Policy"] },
            { title: "Company", links: ["About", "Blog", "Terms of Service", "CCPA / Privacy"] },
          ].map((col, i) => (
            <div key={i}>
              <div className="fc-title">{col.title}</div>
              <ul className="fc-links">{col.links.map((l, j) => <li key={j}><a href="#">{l}</a></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© 2026 Virtual Gender Reveal. All rights reserved.</span>
          <span>Because moments like these deserve to be felt together.</span>
        </div>
      </footer>
    </>
  );
}

// ── Inline CSS blocks (kept here to avoid flash-of-unstyled during Next.js hydration) ──
const CINEMA_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,300;0,400;1,300;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
@keyframes fadeInSkip { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--gold-light:#E8D18A;}
body{font-family:'Plus Jakarta Sans',sans-serif;overflow-x:hidden;}
#cinema{position:fixed;inset:0;z-index:9999;background:#0a0a14;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;}
#cinema.fade-out{animation:cinemaExit 1.1s cubic-bezier(0.4,0,0.2,1) forwards;}
@keyframes cinemaExit{0%{opacity:1;transform:scale(1);}100%{opacity:0;transform:scale(1.06);}}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;pointer-events:none;}
.scene.active{pointer-events:auto;animation:sceneIn 0.7s ease forwards;}
@keyframes sceneIn{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
.s1-sky{position:absolute;inset:0;background:radial-gradient(ellipse 100% 80% at 50% 30%,#C8E6FF 0%,#A8D4F5 25%,#7EB8E8 50%,#5090C8 75%,#1B3A6B 100%);}
.s2-bg{position:absolute;inset:0;background:radial-gradient(ellipse 120% 100% at 50% 20%,#B8D8F8 0%,#90C4F0 30%,#4A8AC8 65%,#1A2E5A 100%);}
.s3-bg{position:absolute;inset:0;background:linear-gradient(180deg,#1A0A00 0%,#3D1A00 40%,#1A0A00 100%);}
.s4-bg{position:absolute;inset:0;background:linear-gradient(180deg,#0A1A3A 0%,#12306B 40%,#0A1A3A 100%);}
.cloud{position:absolute;border-radius:50%;background:rgba(255,255,255,0.85);filter:blur(var(--blur,18px));animation:cloudDrift 9s ease-in-out infinite alternate;}
@keyframes cloudDrift{from{transform:translateX(0);}to{transform:translateX(20px);}}
.bird-wrap{position:absolute;top:32%;left:50%;transform:translate(-50%,-50%);animation:birdGlide 3s ease-in-out infinite alternate;filter:drop-shadow(0 8px 24px rgba(0,80,180,0.25));}
@keyframes birdGlide{from{transform:translate(-50%,-50%) translateY(-10px) rotate(-2deg);}to{transform:translate(-50%,-50%) translateY(10px) rotate(2deg);}}
.cin-text{position:relative;z-index:10;text-align:center;animation:fadeUp 1s ease 0.5s both;}
.cin-text p{font-family:'Playfair Display',serif;font-size:clamp(1.6rem,4vw,2.8rem);font-style:italic;font-weight:300;color:rgba(255,255,255,0.95);text-shadow:0 2px 24px rgba(0,60,140,0.5);letter-spacing:0.02em;line-height:1.4;}
.cin-text em{font-style:italic;}
.dot-row{margin-top:1rem;font-size:0.65rem;letter-spacing:0.35em;color:rgba(255,255,255,0.35);animation:dotPulse 2s ease infinite;}
@keyframes dotPulse{0%,100%{opacity:0.35;}50%{opacity:0.85;}}
.bundle-orb{width:90px;height:90px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:2.4rem;animation:orbPulse 2s ease-in-out infinite;}
.bundle-blue{background:radial-gradient(circle at 35% 35%,#A8D8FF,#2E7DD1);box-shadow:0 0 60px rgba(46,125,209,0.6);}
.bundle-pink{background:radial-gradient(circle at 35% 35%,#FFB8D8,#E07FAA);box-shadow:0 0 60px rgba(224,127,170,0.6);}
.bundle-label{font-size:0.72rem;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.6);}
@keyframes orbPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.08);}}
@keyframes bundleFloat{from{transform:translateY(-8px);}to{transform:translateY(8px);}}
.arena-light{position:absolute;top:0;width:2px;opacity:0.6;background:linear-gradient(to bottom,rgba(255,220,100,0.8),transparent);height:35%;animation:lightSway 3s ease-in-out infinite alternate;}
.arena-light:nth-child(odd){animation-direction:alternate-reverse;}
@keyframes lightSway{from{transform:rotate(-3deg);}to{transform:rotate(3deg);}}
.track-surface{height:60px;border-radius:8px;position:relative;overflow:hidden;background:linear-gradient(90deg,#2A1500,#8B4513,#6B3410,#2A1500);border:2px solid rgba(255,200,100,0.3);box-shadow:0 0 40px rgba(255,150,50,0.2);}
.track-lane{position:absolute;left:0;right:0;height:1px;background:rgba(255,220,100,0.2);}
.horse-arrive{position:absolute;top:50%;transform:translateY(-50%);font-size:1.5rem;animation:horseArrive 1.5s cubic-bezier(0.22,1,0.36,1) 0.5s both;}
@keyframes horseArrive{from{left:-20%;}to{left:20%;}}
.crowd-dots{position:absolute;top:0;left:0;right:0;height:30%;background-image:radial-gradient(circle 2px at 50% 50%,rgba(255,255,255,0.4) 0%,transparent 100%);background-size:20px 16px;animation:crowdWave 2s ease infinite alternate;mask-image:linear-gradient(to bottom,black 50%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,black 50%,transparent 100%);}
@keyframes crowdWave{from{opacity:0.3;}to{opacity:0.7;}}
.race-lane{height:64px;position:relative;margin-bottom:8px;border-radius:4px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);}
.lane-blue{background:linear-gradient(90deg,rgba(26,59,138,0.8),rgba(46,125,209,0.3));}
.lane-pink{background:linear-gradient(90deg,rgba(138,26,70,0.8),rgba(224,127,170,0.3));}
.racer{position:absolute;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:0.4rem;animation:raceRun 1.8s cubic-bezier(0.34,1.56,0.64,1) var(--rd,0s) forwards;}
@keyframes raceRun{from{left:2%;}to{left:var(--stop,55%);}}
@keyframes horseGallop{0%,100%{transform:scaleY(1) rotate(-2deg);}50%{transform:scaleY(0.92) rotate(2deg);}}
.race-label{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:0.7rem;letter-spacing:0.2em;text-transform:uppercase;font-weight:600;opacity:0.7;}
.label-blue{color:#82B8E8;}.label-pink{color:#F2B8CF;}
.obstacle{position:absolute;top:50%;transform:translateY(-50%);font-size:1.6rem;animation:obstacleAppear 0.5s ease var(--oa,1s) both;}
@keyframes obstacleAppear{from{opacity:0;transform:translateY(-50%) scale(0);}to{opacity:1;transform:translateY(-50%) scale(1);}}
.s5-half{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;animation:halfSlide 0.8s cubic-bezier(0.22,1,0.36,1) var(--hs,0s) both;}
@keyframes halfSlide{from{transform:translateY(100%);}to{transform:translateY(0);}}
.s5-blue{background:linear-gradient(160deg,#0D2B6B 0%,#1B4F8C 40%,#2E7DD1 100%);}
.s5-pink{background:linear-gradient(160deg,#6B0D35 0%,#B03060 40%,#E07FAA 100%);}
.s5-divider{position:absolute;top:0;bottom:0;left:50%;width:3px;background:linear-gradient(to bottom,rgba(255,255,255,0.6),rgba(255,255,255,0.2));transform:translateX(-50%);z-index:20;box-shadow:0 0 20px rgba(255,255,255,0.5);}
.confetto{position:absolute;border-radius:2px;animation:confettiFall var(--cf-dur,2s) ease var(--cf-del,0s) infinite;opacity:0;}
@keyframes confettiFall{0%{opacity:0;transform:translateY(-20px) rotate(0deg);top:0;}10%{opacity:1;}90%{opacity:0.6;}100%{opacity:0;transform:translateY(100vh) rotate(720deg);}}
.reveal-big{font-family:'Playfair Display',serif;font-size:clamp(2.5rem,7vw,5.5rem);font-weight:400;color:white;text-align:center;text-shadow:0 4px 40px rgba(0,0,0,0.4);animation:wordPop 0.6s cubic-bezier(0.34,1.56,0.64,1) var(--wp,0.8s) both;line-height:1.1;}
@keyframes wordPop{from{opacity:0;transform:scale(0.5);}to{opacity:1;transform:scale(1);}}
.brand-box{position:relative;z-index:10;text-align:center;animation:wordPop 1s cubic-bezier(0.22,1,0.36,1) 0.6s both;}
.brand-name{font-family:'Playfair Display',serif;font-size:clamp(2rem,5vw,3.5rem);font-weight:400;color:#111827;letter-spacing:0.04em;margin-bottom:0.5rem;}
.brand-tag{font-size:0.85rem;letter-spacing:0.28em;text-transform:uppercase;color:rgba(26,26,46,0.55);font-weight:300;margin-bottom:2rem;}
.enter-btn{display:inline-block;padding:0.9rem 2.6rem;background:linear-gradient(135deg,#2E7DD1,#C2527A);color:white;border:none;border-radius:3px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;font-size:0.8rem;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;box-shadow:0 8px 28px rgba(46,125,209,0.3);transition:transform 0.2s;}
.enter-btn:hover{transform:translateY(-2px);}
.scene-progress{position:absolute;bottom:32px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:100;align-items:center;}
.sp-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.25);transition:background 0.3s,transform 0.3s;}
.sp-dot.active{background:rgba(255,255,255,0.9);transform:scale(1.5);}
`;

const LANDING_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,300;0,400;1,300;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
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
.nav-cta-btn{font-size:0.78rem;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;padding:0.6rem 1.4rem;border-radius:3px;text-decoration:none;background:linear-gradient(135deg,#2E7DD1,#C2527A);color:white;}
.hero-section{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:7rem 2rem 5rem;position:relative;overflow:hidden;background:#fff;}
.hero-mesh{position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 12% 15%,rgba(130,184,232,0.18) 0%,transparent 55%),radial-gradient(ellipse 65% 55% at 88% 10%,rgba(242,184,207,0.2) 0%,transparent 52%);}
.hero-grid-bg{position:absolute;inset:0;background-image:linear-gradient(rgba(27,79,140,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(27,79,140,0.04) 1px,transparent 1px);background-size:64px 64px;mask-image:radial-gradient(ellipse 90% 90% at 50% 50%,black 20%,transparent 75%);-webkit-mask-image:radial-gradient(ellipse 90% 90% at 50% 50%,black 20%,transparent 75%);}
.hero-inner{position:relative;z-index:2;text-align:center;max-width:820px;}
.hero-pill{display:inline-flex;align-items:center;gap:0.5rem;margin-bottom:1.8rem;padding:0.42rem 1.1rem;border-radius:100px;border:1px solid rgba(194,82,122,0.28);background:rgba(253,232,242,0.7);backdrop-filter:blur(8px);font-size:0.7rem;letter-spacing:0.22em;text-transform:uppercase;color:#C2527A;font-weight:500;}
.hero-title{font-family:'Playfair Display',serif;font-size:clamp(3rem,8vw,6rem);font-weight:300;line-height:1.06;margin-bottom:1.5rem;}
.hero-title em{font-style:italic;}
.hero-sub{font-size:clamp(1rem,2vw,1.15rem);font-weight:300;line-height:1.8;color:#6B7280;max-width:560px;margin:0 auto 2.8rem;}
.btn-main{display:inline-flex;align-items:center;gap:0.4rem;padding:1rem 2.2rem;border-radius:3px;text-decoration:none;font-size:0.84rem;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;background:linear-gradient(135deg,#2E7DD1,#C2527A);color:white;box-shadow:0 6px 24px rgba(46,125,209,0.25);transition:transform 0.22s,box-shadow 0.22s;}
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
`;
