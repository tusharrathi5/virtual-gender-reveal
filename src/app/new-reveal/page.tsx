"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import CryptoJS from "crypto-js";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,300;0,400;1,300;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#F4F3F0;color:#111827;min-height:100vh;}
.page-wrap{max-width:700px;margin:0 auto;padding:5rem 2rem 4rem;}
.back-link{display:inline-flex;align-items:center;gap:0.4rem;font-size:0.8rem;color:#6B7280;text-decoration:none;margin-bottom:2.5rem;transition:color 0.2s;}
.back-link:hover{color:#1B4F8C;}
.page-header{margin-bottom:2.5rem;}
.page-title{font-family:'Playfair Display',serif;font-size:2rem;font-weight:300;margin-bottom:0.5rem;}
.page-sub{font-size:0.88rem;color:#6B7280;line-height:1.7;}
.form-card{background:white;border-radius:12px;padding:2.5rem;border:1px solid rgba(0,0,0,0.06);box-shadow:0 2px 16px rgba(0,0,0,0.04);}
.form-section-title{font-size:0.72rem;letter-spacing:0.25em;text-transform:uppercase;color:#9CA3AF;margin-bottom:1.2rem;padding-bottom:0.6rem;border-bottom:1px solid rgba(0,0,0,0.06);}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;}
@media(max-width:600px){.form-grid{grid-template-columns:1fr;}}
.form-group{margin-bottom:1.2rem;}
.form-label{display:block;font-size:0.75rem;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#374151;margin-bottom:0.45rem;}
.form-input,.form-select,.form-textarea{
  width:100%;padding:0.85rem 1rem;border-radius:4px;
  border:1px solid rgba(0,0,0,0.12);background:white;
  font-family:'Plus Jakarta Sans',sans-serif;font-size:0.92rem;color:#111827;
  transition:border-color 0.2s,box-shadow 0.2s;outline:none;
}
.form-textarea{resize:vertical;min-height:90px;line-height:1.6;}
.form-input:focus,.form-select:focus,.form-textarea:focus{border-color:#2E7DD1;box-shadow:0 0 0 3px rgba(46,125,209,0.1);}
.form-input::placeholder,.form-textarea::placeholder{color:#9CA3AF;}
.style-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.8rem;margin-bottom:1.5rem;}
.style-opt{
  border:2px solid rgba(0,0,0,0.08);border-radius:8px;padding:1rem;
  cursor:pointer;text-align:center;transition:border-color 0.2s,background 0.2s;
}
.style-opt:hover{border-color:#2E7DD1;}
.style-opt.selected{border-color:#2E7DD1;background:rgba(46,125,209,0.04);}
.style-emoji{font-size:1.6rem;margin-bottom:0.4rem;}
.style-name{font-size:0.78rem;font-weight:500;}
.style-desc{font-size:0.7rem;color:#9CA3AF;margin-top:0.15rem;}
.form-divider{height:1px;background:rgba(0,0,0,0.06);margin:1.8rem 0;}
.btn-submit{
  width:100%;padding:1.05rem;border:none;border-radius:4px;cursor:pointer;
  background:linear-gradient(135deg,#2E7DD1,#C2527A);color:white;
  font-family:'Plus Jakarta Sans',sans-serif;font-size:0.84rem;font-weight:500;
  letter-spacing:0.1em;text-transform:uppercase;
  box-shadow:0 4px 16px rgba(46,125,209,0.25);
  transition:transform 0.2s,box-shadow 0.2s,opacity 0.2s;
}
.btn-submit:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(46,125,209,0.32);}
.btn-submit:disabled{opacity:0.6;cursor:not-allowed;transform:none;}
.error-msg{font-size:0.8rem;color:#DC2626;padding:0.6rem 0.8rem;background:#FEF2F2;border-radius:4px;border:1px solid rgba(220,38,38,0.15);margin-bottom:1rem;}
.hint{font-size:0.75rem;color:#9CA3AF;margin-top:0.3rem;line-height:1.5;}
`;

const REVEAL_STYLES = [
  { id: "classic",     emoji: "🎀", name: "Classic",     desc: "Timeless & elegant" },
  { id: "cinematic",   emoji: "🎬", name: "Cinematic",   desc: "Dramatic & emotional" },
  { id: "whimsical",   emoji: "✨", name: "Whimsical",   desc: "Magical & playful" },
  { id: "modern",      emoji: "◆", name: "Modern",      desc: "Clean & contemporary" },
  { id: "festive",     emoji: "🎉", name: "Festive",     desc: "Celebratory & fun" },
];

export default function NewRevealPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [style, setStyle] = useState("cinematic");

  const [form, setForm] = useState({
    babyNickname: "",
    parentNames: "",
    dueDate: "",
    doctorEmail: "",
    notes: "",
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError("You must be logged in."); return; }
    setError(""); setLoading(true);
    try {
      const id = uuidv4();
      // Token is generated server-side when doctor is invited — store placeholder
      const tokenHash = CryptoJS.SHA256("pending-" + id).toString();

      const db = getFirebaseDb();
      await setDoc(doc(db, "enquiries", id), {
        userId: user.uid,
        babyNickname: form.babyNickname.trim(),
        parentNames: form.parentNames.trim(),
        dueDate: form.dueDate,
        doctorEmail: form.doctorEmail.trim().toLowerCase(),
        revealStyle: style,
        notes: form.notes.trim(),
        status: "pending_payment",
        doctorTokenHash: tokenHash,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Redirect to payment
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "premium", userId: user.uid }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="page-wrap">
        <a href="/dashboard" className="back-link">← Back to Dashboard</a>
        <div className="page-header">
          <h1 className="page-title">Create Your Reveal</h1>
          <p className="page-sub">Tell us about your little one and we'll take care of everything else — doctor link, video, live broadcast, and more.</p>
        </div>

        <form className="form-card" onSubmit={handleSubmit}>
          {error && <div className="error-msg">⚠ {error}</div>}

          {/* Baby details */}
          <div className="form-section-title">About Your Baby</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Baby Nickname</label>
              <input className="form-input" type="text" placeholder="e.g. Little Sunshine" value={form.babyNickname} onChange={set("babyNickname")} required />
            </div>
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input className="form-input" type="date" value={form.dueDate} onChange={set("dueDate")} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Parents' Names</label>
            <input className="form-input" type="text" placeholder="e.g. Sarah & Michael" value={form.parentNames} onChange={set("parentNames")} required />
          </div>

          <div className="form-divider" />

          {/* Doctor */}
          <div className="form-section-title">Your Revealer (Doctor / Midwife)</div>
          <div className="form-group">
            <label className="form-label">Doctor's Email Address</label>
            <input className="form-input" type="email" placeholder="doctor@clinic.com" value={form.doctorEmail} onChange={set("doctorEmail")} required />
            <div className="hint">We'll send them a private, one-time secure link. They submit the gender — you won't know until the reveal.</div>
          </div>

          <div className="form-divider" />

          {/* Reveal style */}
          <div className="form-section-title">Reveal Style</div>
          <div className="style-grid">
            {REVEAL_STYLES.map(s => (
              <div key={s.id} className={`style-opt${style === s.id ? " selected" : ""}`} onClick={() => setStyle(s.id)}>
                <div className="style-emoji">{s.emoji}</div>
                <div className="style-name">{s.name}</div>
                <div className="style-desc">{s.desc}</div>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Special Requests (optional)</label>
            <textarea className="form-textarea" placeholder="Any special details, preferences, or instructions for our team…" value={form.notes} onChange={set("notes")} />
          </div>

          <div className="form-divider" />
          <button className="btn-submit" type="submit" disabled={loading}>
            {loading ? "Setting up your reveal…" : "✦ Continue to Payment →"}
          </button>
          <div className="hint" style={{ textAlign: "center", marginTop: "0.8rem" }}>
            Secure payment powered by Stripe. You'll be redirected to complete payment.
          </div>
        </form>
      </div>
    </>
  );
}
