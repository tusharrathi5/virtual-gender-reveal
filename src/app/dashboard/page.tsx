"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import type { Enquiry, EnquiryStatus } from "@/lib/types";

/* ── Journey steps definition ───────────────────────────── */
const JOURNEY: { key: EnquiryStatus | "pending_payment"; label: string; icon: string; desc: string }[] = [
  { key: "pending_payment",   label: "Payment",          icon: "💳", desc: "Secure your reveal experience" },
  { key: "awaiting_doctor",   label: "Revealer Notified",icon: "🔗", desc: "Doctor link sent & awaiting" },
  { key: "doctor_confirmed",  label: "Secret Received",  icon: "🔒", desc: "Gender confirmed & encrypted" },
  { key: "video_ready",       label: "Video Ready",      icon: "🎬", desc: "Your reveal video is prepared" },
  { key: "scheduled",         label: "Reveal Scheduled", icon: "📅", desc: "Countdown has begun" },
  { key: "live",              label: "Going Live",       icon: "🎉", desc: "The moment is happening now!" },
];

const STATUS_STEP: Record<string, number> = {
  pending_payment:  0,
  awaiting_doctor:  1,
  doctor_confirmed: 2,
  video_ready:      3,
  scheduled:        4,
  live:             5,
  completed:        5,
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,300;0,400;1,300;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#F4F3F0;color:#111827;min-height:100vh;}

/* ── TOPBAR ── */
.topbar{
  position:sticky;top:0;z-index:100;
  height:64px;display:flex;align-items:center;justify-content:space-between;
  padding:0 2rem;
  background:rgba(255,255,255,0.9);
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  border-bottom:1px solid rgba(0,0,0,0.07);
}
.topbar-logo{font-family:'Playfair Display',serif;font-size:1.15rem;font-weight:400;color:#111827;}
.topbar-logo span{color:#E07FAA;}
.topbar-right{display:flex;align-items:center;gap:1rem;}
.user-chip{display:flex;align-items:center;gap:0.6rem;font-size:0.8rem;color:#6B7280;}
.user-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#2E7DD1,#C2527A);display:flex;align-items:center;justify-content:center;color:white;font-size:0.75rem;font-weight:600;}
.btn-logout{font-size:0.75rem;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;padding:0.45rem 1rem;border-radius:3px;border:1px solid rgba(0,0,0,0.12);background:white;cursor:pointer;color:#6B7280;transition:border-color 0.2s,color 0.2s;}
.btn-logout:hover{border-color:#C2527A;color:#C2527A;}

/* ── LAYOUT ── */
.dash-layout{display:grid;grid-template-columns:260px 1fr;min-height:calc(100vh - 64px);}
@media(max-width:900px){.dash-layout{grid-template-columns:1fr;} .sidebar{display:none;}}

/* ── SIDEBAR ── */
.sidebar{background:white;border-right:1px solid rgba(0,0,0,0.07);padding:2rem 0;}
.sidebar-section{padding:0 1.5rem;margin-bottom:2rem;}
.sidebar-label{font-size:0.6rem;letter-spacing:0.28em;text-transform:uppercase;color:#9CA3AF;margin-bottom:0.8rem;font-weight:500;}
.sidebar-link{display:flex;align-items:center;gap:0.7rem;padding:0.65rem 0.9rem;border-radius:6px;font-size:0.85rem;color:#374151;cursor:pointer;transition:background 0.2s,color 0.2s;margin-bottom:2px;text-decoration:none;}
.sidebar-link:hover{background:#F3F4F6;}
.sidebar-link.active{background:linear-gradient(90deg,rgba(27,79,140,0.08),rgba(194,82,122,0.05));color:#1B4F8C;font-weight:500;}
.sidebar-icon{font-size:1rem;flex-shrink:0;}

/* ── MAIN ── */
.dash-main{padding:2.5rem 2rem;overflow-y:auto;}
.dash-greeting{margin-bottom:2.5rem;}
.dash-greeting h1{font-family:'Playfair Display',serif;font-size:clamp(1.6rem,3vw,2.2rem);font-weight:300;margin-bottom:0.4rem;}
.dash-greeting p{font-size:0.88rem;color:#6B7280;font-weight:300;}

/* ── JOURNEY PROGRESS BAR ── */
.journey-card{
  background:white;border-radius:12px;padding:2.2rem;margin-bottom:2rem;
  border:1px solid rgba(0,0,0,0.06);
  box-shadow:0 2px 16px rgba(0,0,0,0.04);
}
.journey-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.8rem;flex-wrap:wrap;gap:1rem;}
.journey-title{font-size:0.95rem;font-weight:600;}
.journey-subtitle{font-size:0.78rem;color:#6B7280;}
.journey-status-pill{
  font-size:0.65rem;letter-spacing:0.2em;text-transform:uppercase;font-weight:600;
  padding:0.3rem 0.85rem;border-radius:20px;
}
.pill-awaiting{background:#EFF6FF;color:#1B4F8C;}
.pill-confirmed{background:#F0FDF4;color:#16A34A;}
.pill-live{background:linear-gradient(135deg,#1B4F8C,#C2527A);color:white;}
.pill-complete{background:#F3F4F6;color:#6B7280;}

/* Progress track */
.progress-track{position:relative;margin-bottom:2rem;}
.progress-line-bg{
  position:absolute;top:20px;left:20px;right:20px;height:2px;
  background:rgba(0,0,0,0.08);border-radius:1px;z-index:0;
}
.progress-line-fill{
  position:absolute;top:20px;left:20px;height:2px;
  background:linear-gradient(90deg,#2E7DD1,#C2527A);
  border-radius:1px;z-index:1;
  transition:width 1s cubic-bezier(0.4,0,0.2,1);
}
.steps-row{display:flex;justify-content:space-between;position:relative;z-index:2;}
.step-item{display:flex;flex-direction:column;align-items:center;gap:0.5rem;flex:1;}
.step-bubble{
  width:40px;height:40px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-size:1.1rem;transition:all 0.4s;
  border:2px solid transparent;
}
.step-bubble-done{background:linear-gradient(135deg,#2E7DD1,#C2527A);box-shadow:0 4px 12px rgba(46,125,209,0.3);}
.step-bubble-active{background:white;border:2px solid #2E7DD1;box-shadow:0 0 0 4px rgba(46,125,209,0.12);animation:activePulse 2s ease infinite;}
.step-bubble-pending{background:#F3F4F6;border:2px solid rgba(0,0,0,0.08);}
@keyframes activePulse{0%,100%{box-shadow:0 0 0 4px rgba(46,125,209,0.12);}50%{box-shadow:0 0 0 8px rgba(46,125,209,0.06);}}
.step-label{font-size:0.65rem;font-weight:500;letter-spacing:0.04em;text-align:center;color:#6B7280;max-width:60px;line-height:1.3;}
.step-label-active{color:#1B4F8C;font-weight:600;}

/* Current step callout */
.current-step-box{
  display:flex;align-items:flex-start;gap:1rem;
  padding:1.2rem 1.4rem;border-radius:8px;
  background:linear-gradient(135deg,rgba(27,79,140,0.04),rgba(194,82,122,0.04));
  border:1px solid rgba(27,79,140,0.1);
}
.csb-icon{font-size:1.5rem;flex-shrink:0;margin-top:2px;}
.csb-title{font-size:0.9rem;font-weight:600;margin-bottom:0.25rem;}
.csb-desc{font-size:0.8rem;color:#6B7280;font-weight:300;}
.csb-action{margin-top:0.7rem;}
.btn-action{
  display:inline-flex;align-items:center;gap:0.4rem;
  padding:0.6rem 1.3rem;border-radius:4px;border:none;cursor:pointer;
  background:linear-gradient(135deg,#2E7DD1,#C2527A);color:white;
  font-family:'Plus Jakarta Sans',sans-serif;font-size:0.78rem;
  font-weight:500;letter-spacing:0.1em;text-transform:uppercase;
  transition:transform 0.2s,box-shadow 0.2s;
  box-shadow:0 4px 14px rgba(46,125,209,0.22);
}
.btn-action:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(46,125,209,0.3);}

/* ── STATS ROW ── */
.stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;margin-bottom:2rem;}
.stat-card{background:white;border-radius:10px;padding:1.4rem 1.5rem;border:1px solid rgba(0,0,0,0.06);box-shadow:0 1px 8px rgba(0,0,0,0.04);}
.stat-icon{font-size:1.3rem;margin-bottom:0.5rem;}
.stat-val{font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:300;line-height:1;margin-bottom:0.2rem;}
.stat-label{font-size:0.72rem;color:#9CA3AF;letter-spacing:0.08em;text-transform:uppercase;}

/* ── EVENTS TABLE ── */
.events-card{background:white;border-radius:12px;border:1px solid rgba(0,0,0,0.06);box-shadow:0 2px 16px rgba(0,0,0,0.04);overflow:hidden;margin-bottom:2rem;}
.events-head{padding:1.4rem 1.8rem;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;justify-content:space-between;align-items:center;}
.events-head-title{font-size:0.9rem;font-weight:600;}
.btn-new{
  display:inline-flex;align-items:center;gap:0.4rem;
  padding:0.55rem 1.2rem;border-radius:4px;border:none;cursor:pointer;
  background:linear-gradient(135deg,#2E7DD1,#C2527A);color:white;
  font-family:'Plus Jakarta Sans',sans-serif;font-size:0.75rem;font-weight:500;
  letter-spacing:0.1em;text-transform:uppercase;
  box-shadow:0 3px 10px rgba(46,125,209,0.22);
  transition:transform 0.2s;text-decoration:none;
}
.btn-new:hover{transform:translateY(-1px);}
.event-row{
  display:flex;align-items:center;gap:1rem;padding:1.2rem 1.8rem;
  border-bottom:1px solid rgba(0,0,0,0.05);transition:background 0.2s;cursor:pointer;
}
.event-row:last-child{border-bottom:none;}
.event-row:hover{background:#FAFAF9;}
.event-avatar{width:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,#D6EAFE,rgba(242,184,207,0.5));display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;}
.event-info{flex:1;}
.event-name{font-size:0.9rem;font-weight:500;margin-bottom:0.15rem;}
.event-meta{font-size:0.75rem;color:#9CA3AF;}
.event-status{font-size:0.65rem;letter-spacing:0.15em;text-transform:uppercase;font-weight:600;padding:0.28rem 0.7rem;border-radius:20px;}
.es-awaiting{background:#EFF6FF;color:#1B4F8C;}
.es-confirmed{background:#F0FDF4;color:#16A34A;}
.es-ready{background:rgba(184,150,46,0.1);color:#B8962E;}
.es-live{background:linear-gradient(135deg,#1B4F8C,#C2527A);color:white;}
.es-done{background:#F3F4F6;color:#6B7280;}

/* ── EMPTY STATE ── */
.empty-state{text-align:center;padding:4rem 2rem;}
.empty-icon{font-size:3rem;margin-bottom:1rem;}
.empty-title{font-family:'Playfair Display',serif;font-size:1.4rem;font-weight:300;margin-bottom:0.5rem;}
.empty-sub{font-size:0.85rem;color:#6B7280;margin-bottom:1.5rem;line-height:1.7;}

/* ── QUICK ACTIONS ── */
.quick-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:2rem;}
.quick-card{
  background:white;border-radius:10px;padding:1.4rem;
  border:1px solid rgba(0,0,0,0.06);
  box-shadow:0 1px 8px rgba(0,0,0,0.04);
  cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;
  text-decoration:none;color:inherit;display:block;
}
.quick-card:hover{transform:translateY(-3px);box-shadow:0 8px 28px rgba(0,0,0,0.08);}
.qc-icon{font-size:1.5rem;margin-bottom:0.7rem;}
.qc-title{font-size:0.88rem;font-weight:600;margin-bottom:0.25rem;}
.qc-desc{font-size:0.78rem;color:#6B7280;line-height:1.5;}

/* ── LOADING ── */
.loading-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem;}
.spinner{width:36px;height:36px;border:3px solid rgba(46,125,209,0.15);border-top-color:#2E7DD1;border-radius:50%;animation:spin 0.8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
`;

function statusPill(status: EnquiryStatus) {
  const map: Record<string, { cls: string; label: string }> = {
    pending_payment:  { cls: "pill-awaiting", label: "Pending Payment" },
    awaiting_doctor:  { cls: "pill-awaiting", label: "Awaiting Doctor" },
    doctor_confirmed: { cls: "pill-confirmed", label: "Confirmed ✓" },
    video_ready:      { cls: "pill-complete",  label: "Video Ready" },
    scheduled:        { cls: "pill-awaiting",  label: "Scheduled" },
    live:             { cls: "pill-live",      label: "🔴 Live" },
    completed:        { cls: "pill-complete",  label: "Completed" },
  };
  return map[status] ?? { cls: "pill-complete", label: status };
}

function eventStatusCls(status: string) {
  const m: Record<string, string> = {
    awaiting_doctor: "es-awaiting", doctor_confirmed: "es-confirmed",
    video_ready: "es-ready", live: "es-live", completed: "es-done", scheduled: "es-awaiting",
  };
  return m[status] ?? "es-done";
}

function eventStatusLabel(status: string) {
  const m: Record<string, string> = {
    pending_payment: "Pending", awaiting_doctor: "Awaiting Doctor",
    doctor_confirmed: "Confirmed", video_ready: "Video Ready",
    scheduled: "Scheduled", live: "Live!", completed: "Complete",
  };
  return m[status] ?? status;
}

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeEnquiry, setActiveEnquiry] = useState<Enquiry | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/auth");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchEnquiries = async () => {
      try {
        const db = getFirebaseDb();
      const q = query(
          collection(db, "enquiries"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Enquiry));
        setEnquiries(data);
        if (data.length > 0) setActiveEnquiry(data[0]);
      } catch (e) {
        console.error(e);
      } finally {
        setDataLoading(false);
      }
    };
    fetchEnquiries();
  }, [user]);

  const handleLogout = async () => { await logout(); router.push("/"); };

  if (loading || !user) {
    return (
      <>
        <style>{CSS}</style>
        <div className="loading-wrap">
          <div className="spinner" />
          <div style={{ fontSize: "0.82rem", color: "#9CA3AF" }}>Loading your dashboard…</div>
        </div>
      </>
    );
  }

  const currentStep = activeEnquiry ? STATUS_STEP[activeEnquiry.status] ?? 0 : 0;
  const progressPct = activeEnquiry ? (currentStep / (JOURNEY.length - 1)) * 100 : 0;
  const activeJourneyStep = JOURNEY[currentStep];
  const pill = activeEnquiry ? statusPill(activeEnquiry.status) : null;

  // Next action per step
  const NEXT_ACTIONS: Record<number, { label: string; href: string }> = {
    0: { label: "Complete Payment", href: "/#pricing" },
    1: { label: "Check Doctor Status", href: "#" },
    2: { label: "Request Video Creation", href: "#" },
    3: { label: "Schedule Your Reveal", href: "#" },
    4: { label: "View Countdown", href: "#" },
    5: { label: "Open Reveal Room", href: "/room" },
  };
  const nextAction = NEXT_ACTIONS[currentStep];

  return (
    <>
      <style>{CSS}</style>

      {/* Top Bar */}
      <div className="topbar">
        <div className="topbar-logo">Virtual <span>Gender</span> Reveal</div>
        <div className="topbar-right">
          <div className="user-chip">
            <div className="user-avatar">{user.email?.[0].toUpperCase()}</div>
            <span style={{ display: "none" }}>{user.email}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>Sign Out</button>
        </div>
      </div>

      <div className="dash-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-label">Menu</div>
            {[
              { icon: "🏠", label: "Dashboard", href: "/dashboard", active: true },
              { icon: "✦", label: "My Reveals", href: "#", active: false },
              { icon: "👥", label: "Guest List", href: "#", active: false },
              { icon: "🔗", label: "Doctor Link", href: "#", active: false },
              { icon: "🎬", label: "My Videos", href: "#", active: false },
            ].map((l, i) => (
              <a key={i} href={l.href} className={`sidebar-link${l.active ? " active" : ""}`}>
                <span className="sidebar-icon">{l.icon}</span> {l.label}
              </a>
            ))}
          </div>
          <div className="sidebar-section">
            <div className="sidebar-label">Account</div>
            {[
              { icon: "⚙️", label: "Settings", href: "#" },
              { icon: "💳", label: "Billing", href: "#" },
              { icon: "❓", label: "Help Centre", href: "#" },
            ].map((l, i) => (
              <a key={i} href={l.href} className="sidebar-link">
                <span className="sidebar-icon">{l.icon}</span> {l.label}
              </a>
            ))}
          </div>
        </aside>

        {/* Main */}
        <main className="dash-main">
          {/* Greeting */}
          <div className="dash-greeting">
            <h1>Welcome back{user.displayName ? `, ${user.displayName.split(" ")[0]}` : ""} 👋</h1>
            <p>Here's everything you need to manage your reveal experience.</p>
          </div>

          {/* Journey Progress Card */}
          {activeEnquiry && (
            <div className="journey-card">
              <div className="journey-header">
                <div>
                  <div className="journey-title">
                    {activeEnquiry.babyNickname
                      ? `${activeEnquiry.babyNickname}'s Reveal Journey`
                      : "Your Reveal Journey"}
                  </div>
                  <div className="journey-subtitle">Track every step of your experience</div>
                </div>
                {pill && <span className={`journey-status-pill ${pill.cls}`}>{pill.label}</span>}
              </div>

              {/* Track */}
              <div className="progress-track">
                <div className="progress-line-bg" />
                <div className="progress-line-fill" style={{ width: `calc(${progressPct}% * (100% - 40px) / 100%)` }} />
                <div className="steps-row">
                  {JOURNEY.map((step, i) => {
                    const done = i < currentStep;
                    const active = i === currentStep;
                    return (
                      <div className="step-item" key={i} title={step.desc}>
                        <div className={`step-bubble ${done ? "step-bubble-done" : active ? "step-bubble-active" : "step-bubble-pending"}`}>
                          {done ? "✓" : step.icon}
                        </div>
                        <div className={`step-label${active ? " step-label-active" : ""}`}>{step.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Current step callout */}
              <div className="current-step-box">
                <div className="csb-icon">{activeJourneyStep.icon}</div>
                <div>
                  <div className="csb-title">{activeJourneyStep.label}</div>
                  <div className="csb-desc">{activeJourneyStep.desc}</div>
                  {nextAction && (
                    <div className="csb-action">
                      <a href={nextAction.href} className="btn-action">{nextAction.label} →</a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-icon">✦</div>
              <div className="stat-val">{enquiries.length}</div>
              <div className="stat-label">Total Reveals</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-val">—</div>
              <div className="stat-label">Total Guests</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🎬</div>
              <div className="stat-val">{enquiries.filter(e => e.status === "video_ready").length}</div>
              <div className="stat-label">Videos Ready</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🔴</div>
              <div className="stat-val">{enquiries.filter(e => e.status === "live").length}</div>
              <div className="stat-label">Live Now</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-grid">
            {[
              { icon: "✦", title: "Start New Reveal", desc: "Create a new gender reveal event", href: "/#pricing" },
              { icon: "🔗", title: "Doctor Link", desc: "Send or resend the secure doctor link", href: "#" },
              { icon: "👥", title: "Manage Guests", desc: "Upload or add guests to your event", href: "#" },
              { icon: "📅", title: "Schedule Reveal", desc: "Set the date and time for your broadcast", href: "#" },
            ].map((q, i) => (
              <a key={i} href={q.href} className="quick-card">
                <div className="qc-icon">{q.icon}</div>
                <div className="qc-title">{q.title}</div>
                <div className="qc-desc">{q.desc}</div>
              </a>
            ))}
          </div>

          {/* Events / Reveals */}
          <div className="events-card">
            <div className="events-head">
              <div className="events-head-title">My Reveal Events</div>
              <a href="/#pricing" className="btn-new">+ New Reveal</a>
            </div>
            {dataLoading ? (
              <div style={{ padding: "3rem", textAlign: "center" }}>
                <div className="spinner" style={{ margin: "0 auto" }} />
              </div>
            ) : enquiries.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎀</div>
                <div className="empty-title">No reveals yet</div>
                <div className="empty-sub">Start your first gender reveal and create an unforgettable moment for your family.</div>
                <a href="/#pricing" className="btn-action">✦ Create Your First Reveal</a>
              </div>
            ) : (
              enquiries.map((e, i) => (
                <div className="event-row" key={i} onClick={() => setActiveEnquiry(e)}>
                  <div className="event-avatar">🎀</div>
                  <div className="event-info">
                    <div className="event-name">{e.babyNickname || "Baby Reveal"}</div>
                    <div className="event-meta">
                      {e.dueDate ? `Due ${e.dueDate}` : "—"} &nbsp;·&nbsp; {e.parentNames || user.email}
                    </div>
                  </div>
                  <span className={`event-status ${eventStatusCls(e.status)}`}>{eventStatusLabel(e.status)}</span>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </>
  );
}
