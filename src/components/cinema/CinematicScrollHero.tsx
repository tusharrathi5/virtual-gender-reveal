"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

// ─── Static data ─────────────────────────────────────────────────────────────

const CLOUDS = [
  { w: 305, h: 96,  top: "9%",  left: "2%",  blur: 34, driftSpeed: 12 },
  { w: 188, h: 68,  top: "19%", left: "63%", blur: 24, driftSpeed: 9  },
  { w: 368, h: 120, top: "30%", left: "33%", blur: 46, driftSpeed: 15 },
  { w: 158, h: 60,  top: "7%",  left: "80%", blur: 20, driftSpeed: 8  },
  { w: 228, h: 82,  top: "43%", left: "14%", blur: 30, driftSpeed: 11 },
];

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  left:  `${6  + (i * 5.4) % 90}%`,
  top:   `${8  + (i * 7.1) % 78}%`,
  size:  2 + (i % 3),
  color: i % 2 === 0 ? "rgba(130,184,232,0.68)" : "rgba(242,184,207,0.68)",
  dur:   2.6 + (i % 4) * 0.75,
  del:   i * 0.17,
}));

const SPARKLES = Array.from({ length: 16 }, (_, i) => ({
  left: `${26 + (i * 3.9) % 48}%`,
  top:  `${18 + (i * 4.7) % 50}%`,
  size: 7 + (i % 6),
  dur:  1.2 + (i % 4) * 0.28,
  del:  i * 0.20,
}));

// ─── Component ────────────────────────────────────────────────────────────────

export function CinematicScrollHero({ onCTA }: { onCTA: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress: sp } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // ── Scene opacity cross-fades ──────────────────────────────────────────────
  // S1 is fully visible at rest, fades out as S2 enters
  const s1o = useTransform(sp, [0, 0.03, 0.40, 0.52], [1, 1, 1, 0]);
  // S2 starts fading in slightly before S1 finishes (overlap = soft crossfade)
  const s2o = useTransform(sp, [0.38, 0.52, 0.95, 1.00], [0, 1, 1, 1]);

  // ── Scene 1: sky parallax ──────────────────────────────────────────────────
  // Background drifts up slightly as user scrolls — feels atmospheric
  const skyY = useTransform(sp, [0, 0.52], ["0%", "-7%"]);

  // ── Scene 1: bird flight ───────────────────────────────────────────────────
  // Bird travels the full width of the screen across the S1 scroll window
  const birdX  = useTransform(sp, [0.00, 0.46], ["-24vw", "64vw"]);
  const birdY  = useTransform(sp, [0.00, 0.23, 0.46], ["40vh", "30vh", "22vh"]);
  const birdSc = useTransform(sp, [0.00, 0.46], [0.78, 1.20]);

  // ── Scene 1: text fade-up (enters after a tiny scroll) ────────────────────
  const s1TxtO = useTransform(sp, [0.04, 0.18], [0, 1]);
  const s1TxtY = useTransform(sp, [0.04, 0.18], [34, 0]);

  // ── Scene 2: bird slow hover ───────────────────────────────────────────────
  // Same bird, now stationary — carrying bundles below
  const b2X = useTransform(sp, [0.50, 1.00], ["28vw", "36vw"]);
  const b2Y = useTransform(sp, [0.50, 1.00], ["17vh", "13vh"]);

  // ── Scene 2: bundles rise into frame ──────────────────────────────────────
  const bundleO = useTransform(sp, [0.52, 0.66], [0, 1]);
  const bundleY = useTransform(sp, [0.52, 0.66], [50, 0]);

  // ── Scene 2: text fade-up ─────────────────────────────────────────────────
  const s2TxtO = useTransform(sp, [0.62, 0.76], [0, 1]);
  const s2TxtY = useTransform(sp, [0.62, 0.76], [30, 0]);

  // ── Scroll progress bar ───────────────────────────────────────────────────
  const barW = useTransform(sp, [0, 1], ["0%", "100%"]);

  return (
    <>
      <style>{CSS}</style>

      {/* The 200vh scroll container — sticky child pins to viewport */}
      <div ref={ref} style={{ height: "200vh", position: "relative" }}>
        <div className="sh-sticky">

          {/* Gradient progress bar */}
          <div className="sh-bar-track">
            <motion.div className="sh-bar-fill" style={{ width: barW }} />
          </div>

          {/* ════════════════════════════════════════════════════════════
              SCENE 1 — THE BEGINNING
              Soft morning sky · drifting clouds · bird flies L→R on scroll
              Text fades up after the first subtle scroll nudge
          ════════════════════════════════════════════════════════════ */}
          <motion.div className="sh-scene" style={{ opacity: s1o }}>

            {/* Parallax sky — drifts upward as user scrolls */}
            <motion.div className="sh-sky" style={{ y: skyY }} />

            {/* Five layered cloud puffs with independent drift speeds */}
            {CLOUDS.map((c, i) => (
              <motion.div
                key={i}
                className="sh-cloud"
                style={{
                  width:  c.w,
                  height: c.h,
                  top:    c.top,
                  left:   c.left,
                  filter: `blur(${c.blur}px)`,
                }}
                animate={{ x: [0, 14 + i * 5, 0] }}
                transition={{
                  duration: c.driftSpeed,
                  repeat:   Infinity,
                  ease:     "easeInOut",
                }}
              />
            ))}

            {/* Floating ambient particles */}
            {PARTICLES.map((p, i) => (
              <motion.div
                key={i}
                className="sh-particle"
                style={{
                  left:       p.left,
                  top:        p.top,
                  width:      p.size,
                  height:     p.size,
                  background: p.color,
                }}
                animate={{ y: [-12, 12, -12], opacity: [0.2, 0.8, 0.2] }}
                transition={{
                  duration: p.dur,
                  repeat:   Infinity,
                  delay:    p.del,
                  ease:     "easeInOut",
                }}
              />
            ))}

            {/* Bird — x/y/scale are all driven by scrollYProgress */}
            <motion.div
              className="sh-bird"
              style={{ x: birdX, y: birdY, scale: birdSc }}
            >
              {/* Wing-flap loop runs independently of scroll */}
              <motion.div
                animate={{ y: [-9, 9, -9] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <svg
                  width="132"
                  height="88"
                  viewBox="0 0 132 88"
                  fill="none"
                  aria-hidden="true"
                >
                  {/* Body */}
                  <ellipse cx="66" cy="59" rx="24" ry="13" fill="white" opacity="0.96" />
                  {/* Wings */}
                  <path
                    d="M8 51 Q37 21 66 59 Q95 21 124 51"
                    stroke="white"
                    strokeWidth="3.4"
                    fill="none"
                    strokeLinecap="round"
                  />
                  {/* Soft blue belly glow */}
                  <ellipse cx="66" cy="57" rx="9" ry="6.5" fill="rgba(130,184,232,0.40)" />
                  {/* Head highlight */}
                  <circle cx="66" cy="48" r="3.4" fill="rgba(220,235,255,0.78)" />
                </svg>
              </motion.div>
            </motion.div>

            {/* Scene 1 text — fades and rises after first scroll */}
            <motion.div
              className="sh-text-block"
              style={{ opacity: s1TxtO, y: s1TxtY }}
            >
              <p className="sh-headline sh-headline-dark">
                &ldquo;From a place far beyond&hellip;<br />
                <em>a new journey begins.&rdquo;</em>
              </p>
              <motion.div
                className="sh-ornament"
                animate={{ opacity: [0.28, 0.88, 0.28] }}
                transition={{ duration: 2.6, repeat: Infinity }}
              >
                ◆ &nbsp; ◆ &nbsp; ◆
              </motion.div>
            </motion.div>

            {/* Scroll nudge — bounces gently at the bottom */}
            <div className="sh-scroll-nudge">
              <motion.span
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.7, repeat: Infinity }}
                style={{ display: "inline-block", fontSize: "1.1rem" }}
              >
                ↓
              </motion.span>
              <span>Scroll to experience</span>
            </div>
          </motion.div>

          {/* ════════════════════════════════════════════════════════════
              SCENE 2 — THE SECRET
              Twilight sky · same bird now hovering · glowing bundles rise
              Sparkles drift · text fades up
          ════════════════════════════════════════════════════════════ */}
          <motion.div className="sh-scene" style={{ opacity: s2o }}>

            {/* Deeper twilight gradient */}
            <div className="sh-twilight" />

            {/* Dimmed clouds for depth */}
            {CLOUDS.slice(0, 3).map((c, i) => (
              <motion.div
                key={i}
                className="sh-cloud sh-cloud-dim"
                style={{
                  width:  c.w * 0.86,
                  height: c.h * 0.86,
                  top:    c.top,
                  left:   i === 1 ? "56%" : c.left,
                  filter: `blur(${c.blur + 5}px)`,
                }}
                animate={{ x: [0, -13, 0] }}
                transition={{
                  duration: c.driftSpeed + 4,
                  repeat:   Infinity,
                  ease:     "easeInOut",
                }}
              />
            ))}

            {/* Bird — now hovering, scroll-linked gentle drift */}
            <motion.div
              className="sh-bird sh-bird-s2"
              style={{ x: b2X, y: b2Y }}
            >
              <motion.div
                animate={{ y: [-7, 7, -7] }}
                transition={{ duration: 3.1, repeat: Infinity, ease: "easeInOut" }}
              >
                <svg width="122" height="80" viewBox="0 0 122 80" fill="none" aria-hidden="true">
                  <ellipse cx="61" cy="55" rx="22" ry="12" fill="white" opacity="0.93" />
                  <path
                    d="M7 47 Q33 19 61 55 Q89 19 115 47"
                    stroke="white"
                    strokeWidth="3.1"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <ellipse cx="61" cy="53" rx="8" ry="5.8" fill="rgba(130,184,232,0.30)" />
                </svg>
              </motion.div>
            </motion.div>

            {/* Star sparkles scattered around the bundles */}
            {SPARKLES.map((s, i) => (
              <motion.div
                key={i}
                className="sh-sparkle"
                style={{ left: s.left, top: s.top, width: s.size, height: s.size }}
                animate={{ scale: [0, 1, 0], opacity: [0, 1, 0], rotate: [0, 180] }}
                transition={{
                  duration: s.dur,
                  repeat:   Infinity,
                  delay:    s.del,
                  ease:     "easeInOut",
                }}
              />
            ))}

            {/* Glowing bundles — rise into frame with scroll */}
            <motion.div
              className="sh-bundles"
              style={{ opacity: bundleO, y: bundleY }}
            >
              {/* Blue bundle */}
              <div className="sh-bundle-col">
                <motion.div
                  className="sh-orb sh-orb-blue"
                  animate={{ scale: [1, 1.10, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  💙
                </motion.div>
                <span className="sh-bundle-tag">Boy</span>
              </div>

              {/* Divider */}
              <div className="sh-bundle-sep" />

              {/* Pink bundle */}
              <div className="sh-bundle-col">
                <motion.div
                  className="sh-orb sh-orb-pink"
                  animate={{ scale: [1, 1.10, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                >
                  🩷
                </motion.div>
                <span className="sh-bundle-tag">Girl</span>
              </div>
            </motion.div>

            {/* Scene 2 text */}
            <motion.div
              className="sh-text-block"
              style={{ opacity: s2TxtO, y: s2TxtY }}
            >
              <p className="sh-headline sh-headline-white">
                &ldquo;Two possibilities.<br />
                <em>One beautiful destiny.&rdquo;</em>
              </p>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,300;0,400;1,300;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');

/* ── Layout ── */
.sh-sticky {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
  contain: strict;
}
.sh-scene {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  will-change: opacity;
}

/* ── Scene 1: Sky ── */
.sh-sky {
  position: absolute;
  inset: -10% 0;            /* oversized so parallax shift doesn't show edge */
  background: radial-gradient(
    ellipse 110% 90% at 50% 15%,
    #DAEEFF 0%,
    #B0D8F8 16%,
    #84C2F2 34%,
    #4E96D8 58%,
    #2662B2 80%,
    #163472 100%
  );
  will-change: transform;
}

/* ── Scene 2: Twilight ── */
.sh-twilight {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse 120% 100% at 50% 18%,
    #C8DDF8 0%,
    #8CB4EE 20%,
    #4C7ECE 44%,
    #1E3E76 68%,
    #120E42 86%,
    #0C082A 100%
  );
}

/* ── Clouds ── */
.sh-cloud {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.90);
  will-change: transform;
  pointer-events: none;
}
.sh-cloud-dim {
  background: rgba(170, 210, 252, 0.40);
}

/* ── Bird ── */
.sh-bird {
  position: absolute;
  filter: drop-shadow(0 8px 28px rgba(26, 74, 190, 0.30));
  will-change: transform;
  pointer-events: none;
  z-index: 10;
}
.sh-bird-s2 {
  filter: drop-shadow(0 8px 28px rgba(26, 74, 190, 0.22));
}

/* ── Floating particles ── */
.sh-particle {
  position: absolute;
  border-radius: 50%;
  will-change: transform, opacity;
  pointer-events: none;
}

/* ── Sparkles (star shape) ── */
.sh-sparkle {
  position: absolute;
  background: white;
  clip-path: polygon(
    50% 0%, 61% 35%, 98% 35%, 68% 57%,
    79% 91%, 50% 70%, 21% 91%, 32% 57%,
    2%  35%, 39% 35%
  );
  will-change: transform, opacity;
  pointer-events: none;
}

/* ── Scene text ── */
.sh-text-block {
  position: relative;
  z-index: 20;
  text-align: center;
  max-width: 720px;
  padding: 0 2rem;
  will-change: transform, opacity;
  margin-top: 2.5rem;
}
.sh-headline {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.85rem, 4.5vw, 3.2rem);
  font-style: italic;
  font-weight: 300;
  line-height: 1.45;
  letter-spacing: 0.02em;
}
.sh-headline-dark {
  color: rgba(18, 42, 100, 0.90);
  text-shadow: 0 2px 20px rgba(0, 40, 120, 0.14);
}
.sh-headline-white {
  color: rgba(255, 255, 255, 0.95);
  text-shadow:
    0 2px 24px rgba(0, 30, 120, 0.55),
    0 0  60px rgba(100, 160, 240, 0.25);
}
.sh-ornament {
  margin-top: 1.3rem;
  font-size: 0.62rem;
  letter-spacing: 0.44em;
  color: rgba(24, 56, 140, 0.40);
}

/* ── Glowing bundles ── */
.sh-bundles {
  display: flex;
  align-items: center;
  gap: 4.5rem;
  position: relative;
  z-index: 20;
  margin-bottom: 0.5rem;
  will-change: transform, opacity;
}
.sh-bundle-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
}
.sh-orb {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.6rem;
  will-change: transform, box-shadow;
}
.sh-orb-blue {
  background: radial-gradient(circle at 34% 34%, #C4E4FF, #2E7DD1);
  box-shadow:
    0 0  28px  6px rgba(46, 125, 209, 0.58),
    0 0  65px 18px rgba(46, 125, 209, 0.30),
    0 0 110px 30px rgba(46, 125, 209, 0.14);
}
.sh-orb-pink {
  background: radial-gradient(circle at 34% 34%, #FFCCE4, #E07FAA);
  box-shadow:
    0 0  28px  6px rgba(224, 127, 170, 0.58),
    0 0  65px 18px rgba(224, 127, 170, 0.30),
    0 0 110px 30px rgba(224, 127, 170, 0.14);
}
.sh-bundle-tag {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 0.70rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.55);
}
.sh-bundle-sep {
  width: 1px;
  height: 68px;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(255, 255, 255, 0.38),
    transparent
  );
}

/* ── Scroll nudge ── */
.sh-scroll-nudge {
  position: absolute;
  bottom: 2.8rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 0.68rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(22, 54, 130, 0.42);
  z-index: 30;
  user-select: none;
}

/* ── Progress bar ── */
.sh-bar-track {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.10);
  z-index: 100;
}
.sh-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #2E7DD1, #E07FAA);
  border-radius: 0 2px 2px 0;
  will-change: width;
}

/* ── Mobile ── */
@media (max-width: 640px) {
  .sh-bundles     { gap: 2.8rem; }
  .sh-orb         { width: 82px; height: 82px; font-size: 2.1rem; }
  .sh-bundle-sep  { height: 52px; }
  .sh-headline    { font-size: clamp(1.55rem, 6vw, 2.2rem); }
}
`;
