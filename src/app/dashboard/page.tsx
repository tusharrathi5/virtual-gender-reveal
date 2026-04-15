"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const PLANS = [
  {
    id: "free",
    name: "Spark",
    price: 0,
    label: "Free",
    tagline: "Try the magic",
    color: "#a4b4c8",
    features: [
      "1 reveal event",
      "Basic cinematic intro",
      "Up to 10 guests",
      "Doctor secure link",
      "Standard reveal animation",
    ],
    cta: "Get Started Free",
    popular: false,
    paymentUrl: null,
  },
  {
    id: "premium",
    name: "Lumière",
    price: 199,
    label: "$199",
    tagline: "Most popular",
    color: "#c8a4c4",
    features: [
      "1 reveal event",
      "Full 6-scene cinematic intro",
      "Unlimited guests",
      "Doctor secure link",
      "Premium reveal animations",
      "Live watch party room",
      "HD recording of reveal",
      "Email invitations",
    ],
    cta: "Choose Lumière",
    popular: true,
    paymentUrl: "https://buy.stripe.com/your-lumiere-link",
  },
  {
    id: "custom",
    name: "Maison",
    price: 650,
    label: "$650",
    tagline: "Fully bespoke",
    color: "#c8b4a4",
    features: [
      "Everything in Lumière",
      "Custom branded experience",
      "Bespoke reveal animation",
      "Dedicated event manager",
      "Custom domain",
      "Priority support",
      "Post-reveal highlight reel",
      "Printed keepsake package",
    ],
    cta: "Book Maison",
    popular: false,
    paymentUrl: "https://buy.stripe.com/your-maison-link",
  },
];

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string|null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [toast, setToast] = useState<{message:string;type:"success"|"error"}|null>(null);

  useEffect(() => {
    if (!user) router.push("/auth");
  }, [user, router]);

  function showToast(message: string, type: "success"|"error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.push("/auth");
    } catch {
      showToast("Failed to sign out. Please try again.", "error");
      setLoggingOut(false);
    }
  }

  function handlePlanSelect(plan: typeof PLANS[0]) {
    setSelectedPlan(plan.id);
    if (plan.id === "free") {
      showToast("✦ Free plan activated! You can start setting up your reveal.", "success");
      return;
    }
    if (plan.paymentUrl && plan.paymentUrl !== "https://buy.stripe.com/your-lumiere-link" && plan.paymentUrl !== "https://buy.stripe.com/your-maison-link") {
      window.location.href = plan.paymentUrl;
    } else {
      showToast(`Redirecting to payment for ${plan.name} ($${plan.price})...`, "success");
      // Replace the paymentUrl above with your real Stripe payment links
    }
  }

  if (!user) return null;

  const firstName = user.displayName?.split(" ")[0] || user.email?.split("@")[0] || "there";

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
    .dash-root{min-height:100vh;background:#080508;font-family:'Jost',sans-serif;color:#f5eff5}
    .dash-bg{position:fixed;inset:0;pointer-events:none;overflow:hidden}
    .dash-bg-blob{position:absolute;border-radius:50%;filter:blur(100px);opacity:.1}
    .dash-bg-blob-1{width:600px;height:600px;background:#c8a4c4;top:-200px;right:-100px}
    .dash-bg-blob-2{width:400px;height:400px;background:#a4b4c8;bottom:-100px;left:-100px}
    .dash-header{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:0 40px;height:64px;background:rgba(8,5,8,.8);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.06)}
    .dash-logo{font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:300;letter-spacing:3px;text-transform:uppercase;color:rgba(200,164,196,.8);display:flex;align-items:center;gap:10px}
    .dash-logo::before{content:'✦';font-size:10px;color:#c8a4c4}
    .dash-user{display:flex;align-items:center;gap:12px}
    .dash-avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#c8a4c4,#a4b4c8);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;color:#0a0608;flex-shrink:0}
    .dash-user-name{font-size:13px;font-weight:300;color:rgba(245,239,245,.6)}
    .logout-btn{padding:7px 16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;color:rgba(245,239,245,.4);font-family:'Jost',sans-serif;font-size:12px;font-weight:400;cursor:pointer;transition:all .2s;letter-spacing:.5px}
    .logout-btn:hover{background:rgba(255,255,255,.09);color:rgba(245,239,245,.7)}
    .dash-main{max-width:1100px;margin:0 auto;padding:60px 24px}
    .dash-welcome{animation:fadeUp .6s ease-out}
    .dash-welcome-tag{font-size:11px;font-weight:400;letter-spacing:3px;text-transform:uppercase;color:rgba(200,164,196,.5);margin-bottom:16px}
    .dash-welcome-title{font-family:'Cormorant Garamond',serif;font-size:44px;font-weight:300;line-height:1.2;color:#f5eff5;margin-bottom:12px}
    .dash-welcome-title em{font-style:italic;color:#c8a4c4}
    .dash-welcome-sub{font-size:14px;font-weight:300;color:rgba(245,239,245,.4);line-height:1.6;max-width:500px;margin-bottom:60px}
    .section-label{font-size:11px;font-weight:400;letter-spacing:3px;text-transform:uppercase;color:rgba(245,239,245,.25);margin-bottom:32px;display:flex;align-items:center;gap:16px}
    .section-label::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.06)}
    .plans-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-bottom:60px}
    @media(min-width:900px){.plans-grid{grid-template-columns:repeat(3,1fr)}}
    .plan-card{position:relative;border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);transition:all .3s;cursor:pointer;animation:fadeUp .6s ease-out both}
    .plan-card:hover{border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.05);transform:translateY(-4px)}
    .plan-card.selected{border-color:rgba(200,164,196,.4);background:rgba(200,164,196,.06)}
    .plan-card.popular{border-color:rgba(200,164,196,.25)}
    .popular-badge{position:absolute;top:-1px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#c8a4c4,#a48cc0);color:#0a0608;font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase;padding:4px 14px;border-radius:0 0 8px 8px}
    .plan-dot{width:8px;height:8px;border-radius:50%;margin-bottom:20px}
    .plan-name{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:300;color:#f5eff5;margin-bottom:4px}
    .plan-tagline{font-size:11px;font-weight:300;letter-spacing:2px;text-transform:uppercase;color:rgba(245,239,245,.3);margin-bottom:24px}
    .plan-price{font-family:'Cormorant Garamond',serif;font-size:48px;font-weight:300;color:#f5eff5;line-height:1;margin-bottom:4px}
    .plan-price span{font-size:16px;font-weight:300;color:rgba(245,239,245,.4);vertical-align:top;margin-top:10px;display:inline-block}
    .plan-price-sub{font-size:11px;font-weight:300;color:rgba(245,239,245,.2);margin-bottom:28px;letter-spacing:.5px}
    .plan-divider{height:1px;background:rgba(255,255,255,.06);margin-bottom:24px}
    .plan-features{list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:32px}
    .plan-feature{display:flex;align-items:flex-start;gap:10px;font-size:13px;font-weight:300;color:rgba(245,239,245,.6);line-height:1.4}
    .plan-feature-check{font-size:10px;flex-shrink:0;margin-top:2px}
    .plan-btn{width:100%;padding:13px 20px;border:none;border-radius:10px;font-family:'Jost',sans-serif;font-size:12px;font-weight:500;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .25s}
    .plan-btn-primary{background:linear-gradient(135deg,rgba(200,164,196,.9),rgba(164,140,180,.9));color:#0a0608}
    .plan-btn-primary:hover{background:linear-gradient(135deg,rgba(218,185,215,.95),rgba(185,160,200,.95));transform:translateY(-1px);box-shadow:0 8px 25px rgba(200,164,196,.25)}
    .plan-btn-outline{background:transparent;border:1px solid rgba(255,255,255,.1);color:rgba(245,239,245,.5)}
    .plan-btn-outline:hover{border-color:rgba(255,255,255,.2);color:rgba(245,239,245,.8)}
    .plan-btn-selected{background:rgba(200,164,196,.2);border:1px solid rgba(200,164,196,.4);color:#c8a4c4}
    .status-section{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:32px;animation:fadeUp .8s ease-out both}
    .status-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;color:#f5eff5;margin-bottom:20px}
    .status-steps{display:flex;flex-direction:column;gap:0}
    .status-step{display:flex;align-items:flex-start;gap:20px;padding:16px 0;border-bottom:1px solid rgba(255,255,255,.04)}
    .status-step:last-child{border-bottom:none}
    .step-number{width:28px;height:28px;border-radius:50%;border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:400;color:rgba(245,239,245,.3);flex-shrink:0}
    .step-number.done{background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.3);color:#22c55e}
    .step-number.current{background:rgba(200,164,196,.1);border-color:rgba(200,164,196,.3);color:#c8a4c4;animation:pulse 2s ease-in-out infinite}
    .step-content h4{font-size:13px;font-weight:400;color:rgba(245,239,245,.8);margin-bottom:3px}
    .step-content p{font-size:12px;font-weight:300;color:rgba(245,239,245,.3);line-height:1.5}
    .toast-wrap{position:fixed;top:24px;right:24px;z-index:9999;animation:slideIn .3s ease-out}
    .toast{display:flex;align-items:flex-start;gap:12px;background:#1a1018;border-radius:10px;padding:14px 18px;max-width:360px;box-shadow:0 8px 30px rgba(0,0,0,.4)}
    .toast-success{border:1px solid rgba(34,197,94,.3);border-left:3px solid #22c55e}
    .toast-error{border:1px solid rgba(239,68,68,.3);border-left:3px solid #ef4444}
  `;

  return (
    <>
      <style>{CSS}</style>

      {toast && (
        <div className="toast-wrap">
          <div className={`toast toast-${toast.type}`}>
            <span style={{color:toast.type==="success"?"#22c55e":"#ef4444",fontSize:15,fontWeight:700,flexShrink:0}}>{toast.type==="success"?"✓":"✕"}</span>
            <span style={{color:"#f5eff5",fontSize:13,fontWeight:300,lineHeight:1.5}}>{toast.message}</span>
            <button onClick={()=>setToast(null)} style={{background:"none",border:"none",color:"rgba(245,239,245,.3)",cursor:"pointer",fontSize:18,padding:0,marginLeft:8}}>×</button>
          </div>
        </div>
      )}

      <div className="dash-root">
        <div className="dash-bg">
          <div className="dash-bg-blob dash-bg-blob-1" />
          <div className="dash-bg-blob dash-bg-blob-2" />
        </div>

        {/* Header */}
        <header className="dash-header">
          <div className="dash-logo">VGR Studio</div>
          <div className="dash-user">
            <div className="dash-avatar">{firstName.charAt(0).toUpperCase()}</div>
            <span className="dash-user-name">{user.displayName || user.email}</span>
            <button className="logout-btn" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        </header>

        <main className="dash-main">
          {/* Welcome */}
          <div className="dash-welcome">
            <p className="dash-welcome-tag">Your Dashboard</p>
            <h1 className="dash-welcome-title">Hello, <em>{firstName}</em> ✦</h1>
            <p className="dash-welcome-sub">
              Welcome to your reveal studio. Choose a plan below to begin creating your cinematic gender reveal experience.
            </p>
          </div>

          {/* Pricing Plans */}
          <p className="section-label">Choose Your Plan</p>
          <div className="plans-grid">
            {PLANS.map((plan, i) => (
              <div
                key={plan.id}
                className={`plan-card${plan.popular?" popular":""}${selectedPlan===plan.id?" selected":""}`}
                style={{animationDelay:`${i*0.1}s`}}
                onClick={()=>handlePlanSelect(plan)}
              >
                {plan.popular && <div className="popular-badge">Most Popular</div>}
                <div className="plan-dot" style={{background:plan.color,boxShadow:`0 0 12px ${plan.color}60`}} />
                <h3 className="plan-name">{plan.name}</h3>
                <p className="plan-tagline">{plan.tagline}</p>
                <div className="plan-price">
                  {plan.price===0?"Free":<><span>$</span>{plan.price}</>}
                </div>
                <p className="plan-price-sub">{plan.price===0?"Always free":"one-time payment"}</p>
                <div className="plan-divider" />
                <ul className="plan-features">
                  {plan.features.map(f=>(
                    <li key={f} className="plan-feature">
                      <span className="plan-feature-check" style={{color:plan.color}}>✦</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  className={`plan-btn ${selectedPlan===plan.id?"plan-btn-selected":plan.popular?"plan-btn-primary":"plan-btn-outline"}`}
                  onClick={e=>{e.stopPropagation();handlePlanSelect(plan);}}
                >
                  {selectedPlan===plan.id?"✓ Selected":plan.cta}
                </button>
              </div>
            ))}
          </div>

          {/* Journey Steps */}
          <p className="section-label">Your Reveal Journey</p>
          <div className="status-section">
            <h3 className="status-title">Getting Started</h3>
            <div className="status-steps">
              {[
                {num:"✓",label:"Account Created",desc:"You're signed in and ready to go.",done:true,current:false},
                {num:"2",label:"Choose a Plan",desc:"Select the experience that's right for you.",done:!!selectedPlan,current:!selectedPlan},
                {num:"3",label:"Invite Your Doctor",desc:"We'll send a secure, one-time link for the gender submission.",done:false,current:!!selectedPlan},
                {num:"4",label:"Set Your Reveal Date",desc:"Choose when the magic happens — and who gets to watch.",done:false,current:false},
                {num:"5",label:"Go Live",desc:"Your cinematic reveal plays out in real time for everyone you love.",done:false,current:false},
              ].map(step=>(
                <div key={step.label} className="status-step">
                  <div className={`step-number${step.done?" done":step.current?" current":""}`}>{step.done?"✓":step.num}</div>
                  <div className="step-content">
                    <h4>{step.label}</h4>
                    <p>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
