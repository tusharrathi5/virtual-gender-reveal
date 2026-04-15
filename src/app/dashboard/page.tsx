"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const PLANS = [
  {
    id:"free",name:"Spark",price:0,label:"Free",tagline:"Try the magic",color:"#a4b4c8",
    features:["1 reveal event","Basic cinematic intro","Up to 10 guests","Doctor secure link","Standard reveal animation"],
    cta:"Get Started Free",popular:false,paymentUrl:null,
  },
  {
    id:"premium",name:"Lumière",price:199,label:"$199",tagline:"Most popular",color:"#c8a4c4",
    features:["1 reveal event","Full 6-scene cinematic intro","Unlimited guests","Doctor secure link","Premium reveal animations","Live watch party room","HD recording","Email invitations"],
    cta:"Choose Lumière",popular:true,paymentUrl:null,
  },
  {
    id:"custom",name:"Maison",price:650,label:"$650",tagline:"Fully bespoke",color:"#c8b4a4",
    features:["Everything in Lumière","Custom branded experience","Bespoke reveal animation","Dedicated event manager","Custom domain","Priority support","Post-reveal highlight reel","Printed keepsake package"],
    cta:"Book Maison",popular:false,paymentUrl:null,
  },
];

type Plan = typeof PLANS[0];

function ConfirmDialog({ plan, onConfirm, onCancel }: { plan: Plan; onConfirm: ()=>void; onCancel: ()=>void }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      {/* Backdrop */}
      <div onClick={onCancel} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(8px)"}}/>
      {/* Dialog */}
      <div style={{
        position:"relative",width:"100%",maxWidth:460,
        background:"#120e12",border:`1px solid ${plan.color}30`,
        borderTop:`2px solid ${plan.color}`,
        borderRadius:16,padding:"40px 36px",
        boxShadow:`0 25px 60px rgba(0,0,0,0.6), 0 0 40px ${plan.color}15`,
        animation:"dialogIn 0.25s ease-out",fontFamily:"'Jost',sans-serif",
      }}>
        <div style={{width:10,height:10,borderRadius:"50%",background:plan.color,boxShadow:`0 0 16px ${plan.color}`,marginBottom:24}}/>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,fontWeight:300,color:"#f5eff5",lineHeight:1.2,marginBottom:8}}>
          Confirm your <em style={{fontStyle:"italic",color:plan.color}}>plan</em>
        </h2>
        <p style={{fontSize:13,fontWeight:300,color:"rgba(245,239,245,0.4)",lineHeight:1.6,marginBottom:28}}>
          You are about to proceed with the <strong style={{color:"rgba(245,239,245,0.8)",fontWeight:400}}>{plan.name}</strong> plan
          {plan.price > 0 ? ` at a one-time payment of $${plan.price}.` : " — completely free."}
        </p>

        {/* Plan summary */}
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"16px 20px",marginBottom:28}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:300,color:"#f5eff5"}}>{plan.name}</span>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:300,color:plan.color}}>{plan.price===0?"Free":`$${plan.price}`}</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {plan.features.slice(0,4).map(f=>(
              <div key={f} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:300,color:"rgba(245,239,245,0.45)"}}>
                <span style={{color:plan.color,fontSize:9}}>✦</span>{f}
              </div>
            ))}
            {plan.features.length>4&&<div style={{fontSize:11,color:"rgba(245,239,245,0.25)",marginTop:2}}>+{plan.features.length-4} more features</div>}
          </div>
        </div>

        <div style={{display:"flex",gap:12}}>
          <button onClick={onCancel} style={{
            flex:1,padding:"13px 20px",background:"transparent",
            border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,
            color:"rgba(245,239,245,0.4)",fontFamily:"'Jost',sans-serif",
            fontSize:12,fontWeight:400,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",transition:"all .2s",
          }}
          onMouseEnter={e=>(e.currentTarget.style.borderColor="rgba(255,255,255,0.2)")}
          onMouseLeave={e=>(e.currentTarget.style.borderColor="rgba(255,255,255,0.1)")}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{
            flex:2,padding:"13px 20px",
            background:`linear-gradient(135deg,${plan.color}e6,${plan.color}99)`,
            border:"none",borderRadius:10,
            color:"#0a0608",fontFamily:"'Jost',sans-serif",
            fontSize:12,fontWeight:500,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",transition:"all .25s",
          }}
          onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=`0 8px 25px ${plan.color}40`}}
          onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}>
            Yes, Proceed →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [confirmPlan, setConfirmPlan] = useState<Plan|null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string|null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(()=>{ if(!user) router.push("/auth"); },[user,router]);
  if(!user) return null;

  const firstName = user.displayName?.split(" ")[0] || user.email?.split("@")[0] || "there";

  function handlePlanClick(plan: Plan) { setConfirmPlan(plan); }

  function handleConfirm() {
    if(!confirmPlan) return;
    setSelectedPlan(confirmPlan.id);
    setConfirmPlan(null);
    // Redirect to payment page with plan info
    router.push(`/payment?plan=${confirmPlan.id}&name=${encodeURIComponent(confirmPlan.name)}&price=${confirmPlan.price}`);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try { await logout(); router.push("/"); }
    catch { setLoggingOut(false); }
  }

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes dialogIn{from{opacity:0;transform:scale(0.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
    .dash-root{min-height:100vh;background:#080508;font-family:'Jost',sans-serif;color:#f5eff5}
    .dash-bg{position:fixed;inset:0;pointer-events:none;overflow:hidden}
    .dash-blob{position:absolute;border-radius:50%;filter:blur(100px);opacity:.1}
    .dash-blob-1{width:600px;height:600px;background:#c8a4c4;top:-200px;right:-100px}
    .dash-blob-2{width:400px;height:400px;background:#a4b4c8;bottom:-100px;left:-100px}
    .dash-header{position:sticky;top:0;z-index:99;display:flex;align-items:center;justify-content:space-between;padding:0 40px;height:64px;background:rgba(8,5,8,.85);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.06)}
    .dash-logo{font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:300;letter-spacing:3px;text-transform:uppercase;color:rgba(200,164,196,.8);display:flex;align-items:center;gap:8px;text-decoration:none;cursor:pointer}
    .dash-logo::before{content:'✦';font-size:10px;color:#c8a4c4}
    .dash-user{display:flex;align-items:center;gap:12px}
    .dash-avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#c8a4c4,#a4b4c8);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;color:#0a0608;flex-shrink:0}
    .dash-user-name{font-size:13px;font-weight:300;color:rgba(245,239,245,.5);display:none}
    @media(min-width:640px){.dash-user-name{display:block}}
    .logout-btn{padding:7px 16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;color:rgba(245,239,245,.4);font-family:'Jost',sans-serif;font-size:12px;cursor:pointer;transition:all .2s;letter-spacing:.5px}
    .logout-btn:hover{background:rgba(255,255,255,.09);color:rgba(245,239,245,.7)}
    .dash-main{max-width:1100px;margin:0 auto;padding:56px 24px}
    .welcome-block{animation:fadeUp .5s ease-out;margin-bottom:56px}
    .welcome-tag{font-size:11px;font-weight:400;letter-spacing:3px;text-transform:uppercase;color:rgba(200,164,196,.45);margin-bottom:14px}
    .welcome-title{font-family:'Cormorant Garamond',serif;font-size:44px;font-weight:300;color:#f5eff5;line-height:1.2;margin-bottom:10px}
    .welcome-title em{font-style:italic;color:#c8a4c4}
    .welcome-sub{font-size:14px;font-weight:300;color:rgba(245,239,245,.35);line-height:1.6;max-width:480px}
    .section-label{font-size:11px;font-weight:400;letter-spacing:3px;text-transform:uppercase;color:rgba(245,239,245,.2);margin-bottom:28px;display:flex;align-items:center;gap:16px}
    .section-label::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.05)}
    .plans-grid{display:grid;gap:18px;margin-bottom:56px;grid-template-columns:1fr}
    @media(min-width:640px){.plans-grid{grid-template-columns:repeat(2,1fr)}}
    @media(min-width:900px){.plans-grid{grid-template-columns:repeat(3,1fr)}}
    .plan-card{position:relative;border-radius:16px;padding:30px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025);transition:all .3s;cursor:pointer;animation:fadeUp .6s ease-out both}
    .plan-card:hover{border-color:rgba(255,255,255,.14);background:rgba(255,255,255,.045);transform:translateY(-3px)}
    .plan-card.popular-card{border-color:rgba(200,164,196,.2)}
    .popular-badge{position:absolute;top:-1px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#c8a4c4,#a48cc0);color:#0a0608;font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase;padding:4px 14px;border-radius:0 0 8px 8px;white-space:nowrap}
    .plan-dot{width:8px;height:8px;border-radius:50%;margin-bottom:18px}
    .plan-name{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:300;color:#f5eff5;margin-bottom:3px}
    .plan-tagline{font-size:11px;font-weight:300;letter-spacing:2px;text-transform:uppercase;color:rgba(245,239,245,.28);margin-bottom:22px}
    .plan-price{font-family:'Cormorant Garamond',serif;font-size:46px;font-weight:300;color:#f5eff5;line-height:1;margin-bottom:3px}
    .plan-price-sub{font-size:11px;font-weight:300;color:rgba(245,239,245,.2);margin-bottom:24px;letter-spacing:.5px}
    .plan-divider{height:1px;background:rgba(255,255,255,.06);margin-bottom:20px}
    .plan-features{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:28px}
    .plan-feature{display:flex;align-items:flex-start;gap:9px;font-size:12.5px;font-weight:300;color:rgba(245,239,245,.55);line-height:1.4}
    .plan-btn{width:100%;padding:13px 20px;border:none;border-radius:10px;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .25s}
    .plan-btn-primary{background:linear-gradient(135deg,rgba(200,164,196,.9),rgba(164,140,180,.9));color:#0a0608}
    .plan-btn-primary:hover{background:linear-gradient(135deg,rgba(218,185,215,.95),rgba(185,160,200,.95));transform:translateY(-1px);box-shadow:0 8px 25px rgba(200,164,196,.25)}
    .plan-btn-outline{background:transparent;border:1px solid rgba(255,255,255,.1);color:rgba(245,239,245,.45)}
    .plan-btn-outline:hover{border-color:rgba(255,255,255,.2);color:rgba(245,239,245,.75)}
    .journey-card{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:16px;padding:30px;animation:fadeUp .7s ease-out both}
    .journey-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;color:#f5eff5;margin-bottom:20px}
    .step{display:flex;align-items:flex-start;gap:18px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.04)}
    .step:last-child{border-bottom:none}
    .step-num{width:28px;height:28px;border-radius:50%;border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:11px;color:rgba(245,239,245,.3);flex-shrink:0}
    .step-num.done{background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.3);color:#22c55e}
    .step-num.active{background:rgba(200,164,196,.1);border-color:rgba(200,164,196,.3);color:#c8a4c4;animation:pulse 2s ease-in-out infinite}
    .step-content h4{font-size:13px;font-weight:400;color:rgba(245,239,245,.75);margin-bottom:2px}
    .step-content p{font-size:12px;font-weight:300;color:rgba(245,239,245,.28);line-height:1.5}
  `;

  return (
    <>
      <style>{CSS}</style>

      {confirmPlan && (
        <ConfirmDialog plan={confirmPlan} onConfirm={handleConfirm} onCancel={()=>setConfirmPlan(null)}/>
      )}

      <div className="dash-root">
        <div className="dash-bg">
          <div className="dash-blob dash-blob-1"/><div className="dash-blob dash-blob-2"/>
        </div>

        <header className="dash-header">
          <div className="dash-logo" onClick={()=>router.push("/")}>VGR Studio</div>
          <div className="dash-user">
            <div className="dash-avatar">{firstName.charAt(0).toUpperCase()}</div>
            <span className="dash-user-name">{user.displayName||user.email}</span>
            <button className="logout-btn" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut?"Signing out...":"Sign Out"}
            </button>
          </div>
        </header>

        <main className="dash-main">
          <div className="welcome-block">
            <p className="welcome-tag">Your Dashboard</p>
            <h1 className="welcome-title">Hello, <em>{firstName}</em> ✦</h1>
            <p className="welcome-sub">Welcome to your reveal studio. Choose a plan to begin creating your cinematic gender reveal experience.</p>
          </div>

          <p className="section-label">Choose Your Plan</p>
          <div className="plans-grid">
            {PLANS.map((plan,i)=>(
              <div key={plan.id} className={`plan-card${plan.popular?" popular-card":""}`} style={{animationDelay:`${i*0.1}s`}} onClick={()=>handlePlanClick(plan)}>
                {plan.popular&&<div className="popular-badge">Most Popular</div>}
                <div className="plan-dot" style={{background:plan.color,boxShadow:`0 0 12px ${plan.color}60`}}/>
                <h3 className="plan-name">{plan.name}</h3>
                <p className="plan-tagline">{plan.tagline}</p>
                <div className="plan-price">{plan.price===0?"Free":`$${plan.price}`}</div>
                <p className="plan-price-sub">{plan.price===0?"Always free":"one-time payment"}</p>
                <div className="plan-divider"/>
                <ul className="plan-features">
                  {plan.features.map(f=>(
                    <li key={f} className="plan-feature">
                      <span style={{color:plan.color,fontSize:9,marginTop:3,flexShrink:0}}>✦</span>{f}
                    </li>
                  ))}
                </ul>
                <button className={`plan-btn ${plan.popular?"plan-btn-primary":"plan-btn-outline"}`} onClick={e=>{e.stopPropagation();handlePlanClick(plan);}}>
                  {selectedPlan===plan.id?"✓ Selected":plan.cta}
                </button>
              </div>
            ))}
          </div>

          <p className="section-label">Your Reveal Journey</p>
          <div className="journey-card">
            <h3 className="journey-title">Getting Started</h3>
            {[
              {num:"✓",label:"Account Created",desc:"You're signed in and ready to go.",done:true,active:false},
              {num:"2",label:"Choose a Plan",desc:"Select the experience that's right for you.",done:!!selectedPlan,active:!selectedPlan},
              {num:"3",label:"Complete Payment",desc:"Secure checkout — one-time payment, no subscriptions.",done:false,active:!!selectedPlan},
              {num:"4",label:"Invite Your Doctor",desc:"We'll send a secure, one-time link for the gender submission.",done:false,active:false},
              {num:"5",label:"Go Live",desc:"Your cinematic reveal plays out in real time for everyone you love.",done:false,active:false},
            ].map(step=>(
              <div key={step.label} className="step">
                <div className={`step-num${step.done?" done":step.active?" active":""}`}>{step.done?"✓":step.num}</div>
                <div className="step-content"><h4>{step.label}</h4><p>{step.desc}</p></div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}
