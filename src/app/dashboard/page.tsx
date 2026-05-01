"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { PLANS, type PlanDefinition } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────

interface RevealSummary {
  id: string;
  mode: "announcement" | "reveal";
  parentName: string;
  revealAt: Date | null;
  status: string;
  genderStatus: string;
  photos: string[];
  createdAt: Date | null;
}

// ─── Toast ──────────────────────────────────────────────────

type ToastType = "success" | "error" | "info";

function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  const colors = { success: "#22c55e", error: "#ef4444", info: "#2E7DD1" };
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
  
  function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending_payment: "#9CA3AF",
    awaiting_revealer: "#F59E0B",
    revealer_confirmed: "#2E7DD1",
    video_ready: "#8B5CF6",
    scheduled: "#2E7DD1",
    live: "#EF4444",
    completed: "#22C55E",
  };
  return map[status] || "#6B7280";
}

// ─── Dashboard Content ──────────────────────────────────────

function DashboardContent() {
  const { user, firestoreUser, loading, logout, refreshFirestoreUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [reveals, setReveals] = useState<RevealSummary[]>([]);
  const [revealsLoading, setRevealsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [activatingPlan, setActivatingPlan] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [guestCsv, setGuestCsv] = useState("");
  const [sendingInvites, setSendingInvites] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);


  useEffect(() => {
    if (!loading && firestoreUser?.role?.toLowerCase() === "admin") {
      router.replace("/admin");
    }
  }, [loading, firestoreUser, router]);

  // Handle redirect params (from Stripe + from new-reveal form)
  useEffect(() => {
    const payment = searchParams.get("payment");
    const plan = searchParams.get("plan");
    const created = searchParams.get("created");
    if (payment === "success") {
      setToast({
        message: plan
          ? `Payment successful! ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan activated.`
          : "Payment successful!",
        type: "success",
      });
      // Refresh user doc to pick up new entitlement
      refreshFirestoreUser();
      // Clean the URL
      router.replace("/dashboard");
    } else if (payment === "cancelled") {
      setToast({ message: "Payment cancelled. You can try again anytime.", type: "info" });
      router.replace("/dashboard");
  } else if (created) {
      setToast({
        message: "Your reveal was created successfully! ✨",
        type: "success",
      });
      refreshFirestoreUser();
      router.replace("/dashboard");
    } else if (searchParams.get("noEntitlement") === "1") {
      setToast({
        message: "Please choose a plan before creating a reveal.",
        type: "info",
      });
      router.replace("/dashboard");
    }
  }, [searchParams, router, refreshFirestoreUser]);

  // Load user's reveals
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const db = getFirebaseDb();
        const q = query(
          collection(db, "enquiries"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const items: RevealSummary[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            mode: data.mode,
            parentName: data.parentName ?? "",
            revealAt: timestampToDate(data.revealAt),
            status: data.status ?? "pending_payment",
            genderStatus: data.genderStatus ?? "not_submitted",
            photos: Array.isArray(data.photos) ? data.photos : [],
            createdAt: timestampToDate(data.createdAt),
          };
        });
        setReveals(items);
      } catch (err) {
        console.error("Failed to load reveals:", err);
      } finally {
        if (!cancelled) setRevealsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (loading || !user) return null;

  const firstName = user.displayName?.split(" ")[0] || user.email?.split("@")[0] || "there";

  // Entitlement state
  const activePlan = firestoreUser?.activePlan ?? "none";
  const revealsAllowed = firestoreUser?.revealsAllowed ?? 0;
  const revealsCreated = firestoreUser?.revealsCreated ?? 0;
  const hasPlan = activePlan !== "none";
  const canCreateReveal = revealsAllowed > 0;


  async function sendGuestInvites(enquiryId: string) {
    if (!user) return;
    const rows = guestCsv.split(/\n+/).map((r) => r.trim()).filter(Boolean);
    const guests = rows.map((r) => { const [name, email] = r.split(",").map((x) => x?.trim()); return { name, email }; }).filter((g) => !!g.name && !!g.email);

    if (guests.length === 0) {
      setToast({ type: "error", message: "Please add guests as: Name, email@example.com (one per line)." });
      return;
    }

    setSendingInvites(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/guest/send-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ enquiryId, guests }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to send invites.");
      setGuestCsv("");
      setToast({ type: "success", message: `Sent ${data.sent ?? guests.length} guest invite(s).` });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to send invites." });
    } finally {
      setSendingInvites(false);
    }
  }

  // ─── Actions ──────────────────────────────────────────────

  async function handleSelectPlan(plan: PlanDefinition) {
    if (activatingPlan) return;
    setActivatingPlan(plan.id);
    try {
      const token = await user!.getIdToken();
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId: plan.id }),
      const data = await res.json();
      if (!res.ok) {
        setToast({ message: data.error || "Failed to activate plan.", type: "error" });
        return;
      }
      if (data.url) {
        // Real Stripe flow — redirect
        window.location.href = data.url;
        return;
      }
      // Dev mode — plan activated directly
      setToast({
        message: data.message || `${plan.name} plan activated.`,
        type: "success",
      });
      await refreshFirestoreUser();
      // If this is the free plan activation, redirect to the form
      if (plan.id === "free") {
        setTimeout(() => router.push("/new-reveal"), 800);
      }
    } catch (err) {
      setToast({ message: "Something went wrong. Please try again.", type: "error" });
    } finally {
      setActivatingPlan(null);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.push("/");
    } catch {
      setLoggingOut(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <>
      <style>{CSS}</style>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="dash-root">
        <header className="dash-header">
          <a href="/" className="dash-logo">
            Virtual Gender Reveal
            <span className="logo-tag">Crafted for Moments That Matter</span>
          </a>
          <div className="dash-user">
            <div className="dash-avatar">{firstName.charAt(0).toUpperCase()}</div>
            <span className="dash-user-name">{user.displayName || user.email}</span>
            <button className="btn-ghost-sm" onClick={() => router.push("/settings")}>Settings</button>
            <button className="btn-ghost-sm" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? "Signing out…" : "Sign Out"}
            </button>
          </div>
        </header>

        <main className="dash-main">
          {/* Welcome */}
          <section className="welcome">
            <p className="welcome-tag">Your Dashboard</p>
            <h1 className="welcome-title">
              Hello, <em>{firstName}</em> ✦
            </h1>
            <p className="welcome-sub">
              {!hasPlan && "Choose a plan to get started creating your reveal."}
              {hasPlan && canCreateReveal && reveals.length === 0 && "You're all set — let's create your reveal."}
              {hasPlan && canCreateReveal && reveals.length > 0 && "You can create another reveal whenever you're ready."}
              {hasPlan && !canCreateReveal && reveals.length > 0 && "Here are your reveals. Buy another plan to create more."}
            </p>
            {hasPlan && (
              <div className="plan-badge">
                <span className="plan-badge-dot" />
                Active Plan: <strong>{PLANS.find((p) => p.id === activePlan)?.name ?? activePlan}</strong>
                <span className="plan-badge-sep">•</span>
                <span>{revealsAllowed} reveal{revealsAllowed === 1 ? "" : "s"} remaining</span>
                <span className="plan-badge-sep">•</span>
                <span>{revealsCreated} created</span>
              </div>
            )}
          </section>

          {/* State B/C: Create Reveal CTA (when plan active) */}
          {hasPlan && canCreateReveal && (
            <section className="cta-card">
              <div className="cta-card-inner">
                <div>
                  <p className="section-label">Ready When You Are</p>
                  <h2 className="cta-title">Create Your Reveal</h2>
                  <p className="cta-desc">
                    We&apos;ll walk you through a few simple questions — photos, names, your revealer&apos;s email —
                    and have everything ready in under five minutes.
                  </p>
                </div>
                <button className="btn-primary-lg" onClick={() => router.push("/new-reveal")}>
                  ✦ Start New Reveal →
                </button>
              </div>
            </section>
          )}

          {reveals[0] && (
            <section className="dash-section">
              <p className="section-label">Invite Guests</p>
              <p className="welcome-sub" style={{ marginTop: 0 }}>Add one guest per line: <code>Name, email@example.com</code></p>
              <textarea value={guestCsv} onChange={(e) => setGuestCsv(e.target.value)} placeholder={`Ava, ava@example.com\nNoah, noah@example.com`} style={{ width: "100%", minHeight: 120, border: "1px solid #d1d5db", borderRadius: 10, padding: 12, fontFamily: "inherit" }} />
              <button className="btn-primary-lg" style={{ marginTop: 10 }} onClick={() => sendGuestInvites(reveals[0].id)} disabled={sendingInvites}>
                {sendingInvites ? "Sending invites..." : "Send Guest Invites"}
              </button>
            </section>
          )}

          {/* State C: Existing Reveals */}
          {reveals.length > 0 && (
            <section>
              <p className="section-label">Your Reveals</p>
              <div className="reveals-list">
                {reveals.map((r) => (
                  <div key={r.id} className="reveal-card">
                    <div className="reveal-photo">
                      {r.photos[0] ? (
                        <img src={r.photos[0]} alt="" />
                      ) : (
                        <div className="reveal-photo-placeholder">✦</div>
                      )}
                    </div>
                    <div className="reveal-info">
                      <div className="reveal-mode-tag">
                        {r.mode === "announcement" ? "📣 Announcement" : "🎀 Gender Reveal"}
                      </div>
                      <div className="reveal-parent">{r.parentName || "Untitled"}</div>
                      <div className="reveal-date">{formatRevealDate(r.revealAt)}</div>
                    </div>
                    <div className="reveal-status">
                      <span
                        className="status-dot"
                        style={{ background: statusColor(r.status) }}
                      />
                      <span>{statusLabel(r.status)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {revealsLoading && reveals.length === 0 && hasPlan && (
            <div className="reveals-loading">Loading your reveals…</div>
          )}

          {/* State A: No Plan — Show Pricing */}
          {!hasPlan && (
            <section>
              <p className="section-label">Choose Your Plan</p>
              <div className="plans-grid">
                {PLANS.map((plan) => (
                  <div key={plan.id} className={`plan-card${plan.id === "premium" ? " plan-popular" : ""}`}>
                    {plan.id === "premium" && <div className="plan-badge-top">Most Popular</div>}
                    <div className="plan-name">{plan.name}</div>
                    <div className="plan-price">
                      <span className="plan-curr">{plan.priceCents === 0 ? "" : "$"}</span>
                      <span className="plan-amount">
                        {plan.priceCents === 0 ? "Free" : (plan.priceCents / 100).toFixed(0)}
                      </span>
                      {plan.priceCents > 0 && <span className="plan-per"> one-time</span>}
                    </div>
                    <p className="plan-desc">{plan.description}</p>
                    <div className="plan-divider" />
                    <ul className="plan-feats">
                      <li>✓ {plan.revealsGranted} reveal{plan.revealsGranted === 1 ? "" : "s"}</li>
                      <li>✓ Secure revealer link</li>
                      <li>✓ Live broadcast to guests</li>
                      {plan.id === "premium" && <li>✓ Custom cinematic video</li>}
                      {plan.id === "custom" && <li>✓ Bespoke video + concierge support</li>}
                    </ul>
                    <button
                      className={`plan-btn${plan.id === "premium" ? " plan-btn-primary" : ""}`}
                      onClick={() => handleSelectPlan(plan)}
                      disabled={!!activatingPlan}
                    >
                      {activatingPlan === plan.id ? "Activating…" : `Choose ${plan.name}`}
                    </button>
                  </div>
                ))}
              </div>
              <p className="dev-note">
                Payment system is in preview mode. Plans activate immediately for now.
              </p>
            </section>
          )}

{/* Upgrade section — only for users currently on FREE plan */}
          {activePlan === "free" && (
            <section>
              <p className="section-label">Unlock More</p>
              <div className="upgrade-intro">
                <p className="upgrade-intro-text">
                  You&apos;re on the <strong>Spark</strong> plan. Upgrade anytime for a cinematic,
                  curated reveal experience.
                </p>
              </div>
              <div className="plans-grid">
                {PLANS.filter((p) => p.id !== "free").map((plan) => (
                  <div key={plan.id} className={`plan-card${plan.id === "premium" ? " plan-popular" : ""}`}>
                    {plan.id === "premium" && <div className="plan-badge-top">Most Popular</div>}
                    <div className="plan-name">{plan.name}</div>
                    <div className="plan-price">
                      <span className="plan-curr">$</span>
                      <span className="plan-amount">{(plan.priceCents / 100).toFixed(0)}</span>
                      <span className="plan-per"> one-time</span>
                    </div>
                    <p className="plan-desc">{plan.description}</p>
                    <div className="plan-divider" />
                    <ul className="plan-feats">
                      <li>✓ {plan.revealsGranted} reveal{plan.revealsGranted === 1 ? "" : "s"}</li>
                      <li>✓ Secure revealer link</li>
                      <li>✓ Live broadcast to guests</li>
                      {plan.id === "premium" && <li>✓ Custom cinematic video</li>}
                      {plan.id === "custom" && <li>✓ Bespoke video + concierge support</li>}
                    </ul>
                    <button
                      className={`plan-btn${plan.id === "premium" ? " plan-btn-primary" : ""}`}
                      onClick={() => handleSelectPlan(plan)}
                      disabled={!!activatingPlan}
                    >
                      {activatingPlan === plan.id ? "Activating…" : `Upgrade to ${plan.name}`}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
          
          {/* State B: Plan but no revealsAllowed — offer to buy more */}
          {hasPlan && !canCreateReveal && (
            <section>
              <p className="section-label">Need Another Reveal?</p>
              <div className="plans-grid">
                {PLANS.filter((p) => p.id !== "free").map((plan) => (
                  <div key={plan.id} className={`plan-card${plan.id === "premium" ? " plan-popular" : ""}`}>
                    {plan.id === "premium" && <div className="plan-badge-top">Most Popular</div>}
                    <div className="plan-name">{plan.name}</div>
                    <div className="plan-price">
                      <span className="plan-curr">$</span>
                      <span className="plan-amount">{(plan.priceCents / 100).toFixed(0)}</span>
                      <span className="plan-per"> one-time</span>
                    </div>
                    <p className="plan-desc">{plan.description}</p>
                    <div className="plan-divider" />
                    <button
                      className={`plan-btn${plan.id === "premium" ? " plan-btn-primary" : ""}`}
                      onClick={() => handleSelectPlan(plan)}
                      disabled={!!activatingPlan}
                    >
                      {activatingPlan === plan.id ? "Activating…" : `Buy ${plan.name}`}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#F4F3F0" }} />}>
      <DashboardContent />
    </Suspense>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,300;0,400;1,300;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
@keyframes slideIn{from{opacity:0;transform:translateX(20px);}to{opacity:1;transform:translateX(0);}}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}

body{font-family:'Plus Jakarta Sans',sans-serif;background:#F4F3F0;color:#111827;min-height:100vh;}

.dash-root{min-height:100vh;}

/* Header */
.dash-header{
  position:sticky;top:0;z-index:50;height:64px;
  display:flex;align-items:center;justify-content:space-between;
  padding:0 2rem;background:rgba(244,243,240,0.92);backdrop-filter:blur(14px);
  border-bottom:1px solid rgba(0,0,0,0.06);
}
.dash-logo{
  font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:400;
  color:#111827;text-decoration:none;line-height:1.2;
}
.logo-tag{
  display:block;font-size:0.58rem;font-family:'Plus Jakarta Sans',sans-serif;
  letter-spacing:0.22em;text-transform:uppercase;color:#C2527A;font-weight:400;
}
.dash-user{display:flex;align-items:center;gap:0.7rem;}
.dash-avatar{
  width:32px;height:32px;border-radius:50%;
  background:linear-gradient(135deg,#2E7DD1,#C2527A);
  display:flex;align-items:center;justify-content:center;
  color:white;font-size:13px;font-weight:500;flex-shrink:0;
}
.dash-user-name{font-size:0.82rem;color:#6B7280;display:none;}
@media(min-width:640px){.dash-user-name{display:inline;}}
.btn-ghost-sm{
  padding:6px 14px;background:transparent;
  border:1px solid rgba(0,0,0,0.12);border-radius:6px;
  font-family:'Plus Jakarta Sans',sans-serif;font-size:0.78rem;
  color:#374151;cursor:pointer;transition:all 0.2s;
}
.btn-ghost-sm:hover:not(:disabled){border-color:#2E7DD1;color:#2E7DD1;}
.btn-ghost-sm:disabled{opacity:0.5;cursor:not-allowed;}

/* Main layout */
.dash-main{max-width:1060px;margin:0 auto;padding:3.5rem 2rem 4rem;}

/* Welcome */
.welcome{margin-bottom:3rem;animation:fadeUp 0.5s ease-out;}
.welcome-tag{
  font-size:0.68rem;letter-spacing:0.32em;text-transform:uppercase;
  color:#C2527A;font-weight:500;margin-bottom:0.7rem;
}
.welcome-title{
  font-family:'Playfair Display',serif;font-size:2.8rem;font-weight:300;
  color:#111827;line-height:1.15;margin-bottom:0.6rem;
}
.welcome-title em{font-style:italic;color:#1B4F8C;}
.welcome-sub{
  font-size:0.95rem;font-weight:300;color:#6B7280;
  line-height:1.7;max-width:500px;margin-bottom:1.3rem;
}
.plan-badge{
  display:inline-flex;align-items:center;gap:0.5rem;flex-wrap:wrap;
  padding:0.5rem 1rem;background:white;border:1px solid rgba(0,0,0,0.08);
  border-radius:100px;font-size:0.82rem;color:#374151;
  box-shadow:0 1px 4px rgba(0,0,0,0.04);
}
.plan-badge strong{color:#1B4F8C;font-weight:600;}
.plan-badge-dot{
  width:8px;height:8px;border-radius:50%;
  background:#22C55E;box-shadow:0 0 10px rgba(34,197,94,0.6);
}
.plan-badge-sep{color:#D1D5DB;margin:0 0.2rem;}

/* Section labels */
.section-label{
  font-size:0.68rem;letter-spacing:0.32em;text-transform:uppercase;
  color:#9CA3AF;font-weight:500;margin-bottom:1.2rem;
  display:flex;align-items:center;gap:0.9rem;
}
.section-label::after{content:'';flex:1;height:1px;background:rgba(0,0,0,0.06);}

/* CTA card (create reveal) */
.cta-card{
  background:linear-gradient(135deg,#1B4F8C 0%,#2E7DD1 60%,#C2527A 100%);
  border-radius:12px;padding:2.2rem 2.5rem;margin-bottom:3rem;
  box-shadow:0 10px 30px rgba(27,79,140,0.18);
  animation:fadeUp 0.6s ease-out;
}
.cta-card-inner{
  display:flex;align-items:center;justify-content:space-between;gap:2rem;flex-wrap:wrap;
}
.cta-card .section-label{color:rgba(255,255,255,0.7);margin-bottom:0.5rem;}
.cta-card .section-label::after{background:rgba(255,255,255,0.15);}
.cta-title{
  font-family:'Playfair Display',serif;font-size:2rem;font-weight:300;
  color:white;line-height:1.2;margin-bottom:0.5rem;
}
.cta-desc{
  font-size:0.88rem;font-weight:300;color:rgba(255,255,255,0.8);
  line-height:1.7;max-width:460px;
}
.btn-primary-lg{
  padding:1rem 2.2rem;background:white;color:#1B4F8C;
  border:none;border-radius:4px;cursor:pointer;
  font-family:'Plus Jakarta Sans',sans-serif;font-size:0.82rem;font-weight:600;
  letter-spacing:0.1em;text-transform:uppercase;
  box-shadow:0 6px 20px rgba(0,0,0,0.12);
  transition:transform 0.2s,box-shadow 0.2s;white-space:nowrap;
}
.btn-primary-lg:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,0.18);}

/* Reveals list */
.reveals-list{display:flex;flex-direction:column;gap:0.8rem;margin-bottom:3rem;}
.reveal-card{
  background:white;border:1px solid rgba(0,0,0,0.06);border-radius:10px;
  padding:1rem 1.2rem;display:flex;align-items:center;gap:1.2rem;
  box-shadow:0 1px 4px rgba(0,0,0,0.03);transition:transform 0.2s,box-shadow 0.2s;
}
.reveal-card:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,0.06);}
.reveal-photo{
  width:64px;height:64px;border-radius:8px;overflow:hidden;
  background:#F4F3F0;flex-shrink:0;display:flex;align-items:center;justify-content:center;
}
.reveal-photo img{width:100%;height:100%;object-fit:cover;}
.reveal-photo-placeholder{font-size:1.5rem;color:#C2527A;opacity:0.5;}
.reveal-info{flex:1;min-width:0;}
.reveal-mode-tag{
  font-size:0.7rem;letter-spacing:0.1em;text-transform:uppercase;
  color:#9CA3AF;margin-bottom:0.2rem;
}
.reveal-parent{
  font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:400;
  color:#111827;margin-bottom:0.2rem;
}
.reveal-date{font-size:0.8rem;color:#6B7280;}
.reveal-status{
  display:flex;align-items:center;gap:0.5rem;
  font-size:0.82rem;color:#374151;font-weight:500;white-space:nowrap;
}
.status-dot{width:8px;height:8px;border-radius:50%;}
.reveals-loading{text-align:center;color:#9CA3AF;padding:2rem;font-size:0.88rem;}

/* Plans grid */
.plans-grid{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
  gap:1.2rem;margin-bottom:1.5rem;
}
.plan-card{
  position:relative;background:white;border:1px solid rgba(0,0,0,0.08);
  border-radius:10px;padding:2rem 1.7rem;
  box-shadow:0 2px 10px rgba(0,0,0,0.03);
  transition:transform 0.25s,box-shadow 0.25s;
}
.plan-card:hover{transform:translateY(-4px);box-shadow:0 10px 28px rgba(0,0,0,0.08);}
.plan-popular{border:1.5px solid #2E7DD1;box-shadow:0 10px 28px rgba(46,125,209,0.12);}
.plan-badge-top{
  position:absolute;top:-10px;left:50%;transform:translateX(-50%);
  background:linear-gradient(135deg,#2E7DD1,#C2527A);color:white;
  font-size:0.62rem;letter-spacing:0.2em;text-transform:uppercase;
  padding:0.3rem 0.8rem;border-radius:100px;font-weight:600;white-space:nowrap;
}
.plan-name{
  font-family:'Playfair Display',serif;font-size:1.4rem;font-weight:400;
  color:#111827;margin-bottom:0.8rem;
}
.plan-price{
  font-family:'Playfair Display',serif;font-weight:300;
  color:#111827;margin-bottom:0.6rem;line-height:1;
}
.plan-curr{font-size:1.4rem;vertical-align:super;}
.plan-amount{font-size:3.2rem;}
.plan-per{font-size:0.8rem;font-family:'Plus Jakarta Sans',sans-serif;color:#9CA3AF;}
.plan-desc{font-size:0.85rem;color:#6B7280;line-height:1.6;margin-bottom:1.2rem;font-weight:300;}
.plan-divider{height:1px;background:rgba(0,0,0,0.06);margin-bottom:1.2rem;}
.plan-feats{list-style:none;margin-bottom:1.8rem;}
.plan-feats li{
  font-size:0.83rem;color:#374151;padding:0.3rem 0;
  display:flex;align-items:flex-start;gap:0.5rem;
}
.plan-btn{
  width:100%;padding:0.85rem;background:white;color:#374151;
  border:1.5px solid rgba(0,0,0,0.12);border-radius:4px;cursor:pointer;
  font-family:'Plus Jakarta Sans',sans-serif;font-size:0.78rem;font-weight:500;
  letter-spacing:0.12em;text-transform:uppercase;transition:all 0.2s;
}
.plan-btn:hover:not(:disabled){border-color:#2E7DD1;color:#2E7DD1;}
.plan-btn-primary{
  background:linear-gradient(135deg,#2E7DD1,#C2527A);color:white;border:none;
  box-shadow:0 4px 16px rgba(46,125,209,0.22);
}
.plan-btn-primary:hover:not(:disabled){
  transform:translateY(-1px);box-shadow:0 8px 22px rgba(46,125,209,0.3);color:white;
}
.plan-btn:disabled{opacity:0.5;cursor:not-allowed;}
.dev-note{
  text-align:center;font-size:0.78rem;color:#9CA3AF;
  font-style:italic;margin-top:1.2rem;
}
.upgrade-intro{
  background:white;border:1px solid rgba(0,0,0,0.06);
  border-radius:10px;padding:1.1rem 1.4rem;margin-bottom:1.3rem;
  box-shadow:0 1px 4px rgba(0,0,0,0.03);
}
.upgrade-intro-text{
  font-size:0.88rem;color:#374151;line-height:1.6;font-weight:300;
}
.upgrade-intro-text strong{color:#1B4F8C;font-weight:600;}
@media(max-width:640px){
  .dash-main{padding:2rem 1.2rem 3rem;}
  .welcome-title{font-size:2.2rem;}
  .cta-card{padding:1.8rem 1.5rem;}
  .cta-card-inner{flex-direction:column;align-items:flex-start;}
  .btn-primary-lg{width:100%;}
}
`;
