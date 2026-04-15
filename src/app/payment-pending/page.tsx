"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function PaymentContent() {
  const params = useSearchParams();
  const plan = params.get("name") || "Selected";
  const price = params.get("price") || "0";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes float{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(0,-15px) scale(1.02)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:0.6}50%{opacity:1}}
        .pay-root{min-height:100vh;background:#080508;display:flex;align-items:center;justify-content:center;font-family:'Jost',sans-serif;position:relative;overflow:hidden;padding:40px 24px}
        .blob{position:fixed;border-radius:50%;filter:blur(80px);opacity:.12;pointer-events:none}
        .blob-1{width:500px;height:500px;background:#c8a4c4;top:-150px;left:-150px}
        .blob-2{width:400px;height:400px;background:#a4b4c8;bottom:-100px;right:-100px}
        .card{max-width:480px;width:100%;text-align:center;animation:fadeUp .6s ease-out}
        .icon-wrap{width:80px;height:80px;border-radius:50%;background:rgba(200,164,196,.08);border:1px solid rgba(200,164,196,.2);display:flex;align-items:center;justify-content:center;margin:0 auto 32px;animation:float 4s ease-in-out infinite;font-size:32px}
        .badge{display:inline-block;padding:5px 16px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);border-radius:20px;font-size:10px;font-weight:400;letter-spacing:2px;text-transform:uppercase;color:rgba(251,191,36,.7);margin-bottom:28px;animation:pulse 2s ease-in-out infinite}
        .title{font-family:'Cormorant Garamond',serif;font-size:40px;font-weight:300;color:#f5eff5;line-height:1.2;margin-bottom:8px}
        .title em{font-style:italic;color:#c8a4c4}
        .plan-tag{font-size:13px;font-weight:300;color:rgba(245,239,245,.35);margin-bottom:32px}
        .plan-tag strong{color:rgba(245,239,245,.7);font-weight:400}
        .divider{width:60px;height:1px;background:linear-gradient(90deg,transparent,rgba(200,164,196,.4),transparent);margin:0 auto 32px}
        .desc{font-size:14px;font-weight:300;color:rgba(245,239,245,.4);line-height:1.8;margin-bottom:40px;max-width:380px;margin-left:auto;margin-right:auto}
        .desc strong{color:rgba(245,239,245,.75);font-weight:400}
        .actions{display:flex;flex-direction:column;gap:12px;align-items:center}
        .btn-primary{padding:14px 32px;background:linear-gradient(135deg,rgba(200,164,196,.9),rgba(164,140,180,.9));border:none;border-radius:10px;color:#0a0608;font-family:'Jost',sans-serif;font-size:12px;font-weight:500;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .25s;text-decoration:none;display:inline-block}
        .btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(200,164,196,.25)}
        .btn-ghost{padding:12px 24px;background:transparent;border:1px solid rgba(255,255,255,.08);border-radius:10px;color:rgba(245,239,245,.35);font-family:'Jost',sans-serif;font-size:12px;font-weight:300;letter-spacing:1px;cursor:pointer;transition:all .2s;text-decoration:none;display:inline-block}
        .btn-ghost:hover{border-color:rgba(255,255,255,.16);color:rgba(245,239,245,.6)}
        .footer-note{margin-top:40px;font-size:11px;font-weight:300;color:rgba(245,239,245,.15);letter-spacing:.5px;line-height:1.6}
      `}</style>

      <div className="pay-root">
        <div className="blob blob-1"/><div className="blob blob-2"/>
        <div className="card">
          <div className="icon-wrap">🔧</div>
          <div className="badge">Payment · In Development</div>
          <h1 className="title">Almost <em>there.</em></h1>
          <p className="plan-tag">
            You selected: <strong>{plan} Plan {price !== "0" ? `— $${price}` : "— Free"}</strong>
          </p>
          <div className="divider"/>
          <p className="desc">
            Our secure payment system is currently being set up and will be
            <strong> live very soon</strong>. We&apos;re integrating Stripe to ensure
            your payment is safe and seamless.<br /><br />
            In the meantime, please return to your dashboard. We&apos;ll notify you
            as soon as payments go live.
          </p>
          <div className="actions">
            <a href="/dashboard" className="btn-primary">Back to Dashboard</a>
            <a href="/" className="btn-ghost">Return to Homepage</a>
          </div>
          <p className="footer-note">
            Questions? Contact us at hello@virtualgenderreveal.com<br />
            Payment powered by Stripe · Launching soon
          </p>
        </div>
      </div>
    </>
  );
}

export default function PaymentPendingPage() {
  return (
    <Suspense fallback={<div style={{minHeight:"100vh",background:"#080508"}}/>}>
      <PaymentContent />
    </Suspense>
  );
}
