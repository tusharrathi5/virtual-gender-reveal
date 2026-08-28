"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Gender = "boy" | "girl";

export default function DoctorTokenPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [selected, setSelected] = useState<Gender | null>(null);
  const [pendingGender, setPendingGender] = useState<Gender | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/doctor/${token}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data?.error || "Invalid or expired link");
        }
      } catch {
        setError("Could not connect to secure server.");
      } finally {
        setValidating(false);
      }
    })();
  }, [token]);

  async function confirmSubmit() {
    if (!token || validating || !pendingGender) return;
    const gender = pendingGender;
    setPendingGender(null);
    setLoading(true);
    setError(null);
    setSelected(gender);

    try {
      const res = await fetch(`/api/doctor/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gender }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to submit gender.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit.");
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="portal-shell">
      {/* Background Decorative Ambient Glows */}
      <div className="ambient-glow glow-blue" />
      <div className="ambient-glow glow-pink" />

      <div className="portal-card">
        {/* Logo/Brand Header */}
        <div className="portal-brand">
          <img src="/Favicon-VGR.png" alt="VGR Logo" className="portal-logo" />
          <span className="portal-brand-name">Virtual Gender Reveal</span>
        </div>

        <h1>Secure Gender Portal</h1>
        <p className="portal-sub">
          Submit the baby's gender below. This action is secure, encrypted, and can only be performed once.
        </p>

        {validating ? (
          <div className="status-container">
            <div className="loading-spinner" />
            <p className="status-text">Establishing secure connection…</p>
          </div>
        ) : done ? (
          <div className="success-card">
            <div className="success-badge">✅ Securely Recorded</div>
            <h2>Submission Complete</h2>
            <p>
              Thank you! The gender has been recorded and the virtual reveal is now unlocked for the parents.
            </p>
          </div>
        ) : (
          <div className="portal-content">
            <div className="gender-grid">
              {/* Boy Option */}
              <button
                disabled={loading || !!error}
                onClick={() => setPendingGender("boy")}
                className={`gender-card-btn boy-card ${selected === "boy" ? "selected" : ""}`}
              >
                <img src="/images/boyVote.png" alt="Team Boy" className="gender-avatar-img" />
                <div className="gender-card-title boy-text">Team Boy</div>
                <div className="gender-card-desc">Click here if the baby is a boy</div>
              </button>

              {/* Girl Option */}
              <button
                disabled={loading || !!error}
                onClick={() => setPendingGender("girl")}
                className={`gender-card-btn girl-card ${selected === "girl" ? "selected" : ""}`}
              >
                <img src="/images/girlVote.png" alt="Team Girl" className="gender-avatar-img" />
                <div className="gender-card-title girl-text">Team Girl</div>
                <div className="gender-card-desc">Click here if the baby is a girl</div>
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="status-container">
            <div className="loading-spinner" />
            <p className="status-text">Recording secure submission…</p>
          </div>
        )}

        {error && (
          <div className="error-card">
            <div className="error-icon">⚠️</div>
            <div>
              <h3>Access Restriction</h3>
              <p>{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Custom Confirmation Modal */}
      {pendingGender && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-alert-icon">🔒 Secure Confirmation</div>
            <h3>Double Check Submission</h3>
            <p>
              You are about to submit <strong className={pendingGender === "boy" ? "boy-text" : "girl-text"}>
                TEAM {pendingGender.toUpperCase()}
              </strong>. This is a one-time secure submission and cannot be changed or corrected afterward.
            </p>
            <div className="modal-actions">
              <button onClick={() => setPendingGender(null)} className="modal-btn cancel-btn">
                Cancel
              </button>
              <button
                onClick={confirmSubmit}
                className={`modal-btn confirm-btn ${pendingGender === "boy" ? "boy-confirm-bg" : "girl-confirm-bg"}`}
              >
                Yes, Submit Gender
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .portal-shell {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: #f8fafc;
          font-family: 'Plus Jakarta Sans', sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* Ambient glows matching the sky/party aesthetic */
        .ambient-glow {
          position: absolute;
          width: 60vw;
          height: 60vw;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.28;
          pointer-events: none;
          z-index: 1;
        }
        .glow-blue {
          top: -20%;
          left: -20%;
          background: radial-gradient(circle, #3a9fe8, transparent 70%);
        }
        .glow-pink {
          bottom: -20%;
          right: -20%;
          background: radial-gradient(circle, #e8449a, transparent 70%);
        }

        /* Portal Glassmorphism container */
        .portal-card {
          width: 100%;
          max-width: 720px;
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: 28px;
          padding: 2.5rem;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(100, 60, 200, 0.03);
          z-index: 2;
          text-align: center;
        }

        .portal-brand {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          background: white;
          padding: 0.5rem 1rem;
          border-radius: 50px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
          margin-bottom: 1.8rem;
          border: 1px solid rgba(0, 0, 0, 0.03);
        }
        .portal-logo {
          width: 24px;
          height: 24px;
          object-fit: contain;
        }
        .portal-brand-name {
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: #1a1a2e;
          text-transform: uppercase;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        h1 {
          font-family: 'Nunito', sans-serif;
          font-size: 2.2rem;
          font-weight: 900;
          color: #1a1a2e;
          margin: 0;
          line-height: 1.15;
        }

        .portal-sub {
          font-size: 0.95rem;
          color: #64748b;
          margin: 0.75rem 0 2rem;
          line-height: 1.6;
          max-width: 520px;
          margin-left: auto;
          margin-right: auto;
        }

        /* Option cards styling */
        .gender-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }

        .gender-card-btn {
          background: rgba(255, 255, 255, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.8);
          border-radius: 20px;
          padding: 2.2rem 1.5rem;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          outline: none;
          position: relative;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.02);
        }

        .gender-card-btn:hover {
          transform: translateY(-4px);
          background: white;
        }

        .boy-card:hover {
          border-color: rgba(58, 159, 232, 0.4);
          box-shadow: 0 12px 30px rgba(58, 159, 232, 0.12);
        }

        .girl-card:hover {
          border-color: rgba(232, 68, 154, 0.4);
          box-shadow: 0 12px 30px rgba(232, 68, 154, 0.12);
        }

        .gender-avatar-img {
          width: 96px;
          height: 96px;
          border-radius: 50%;
          object-fit: cover;
          margin: 0 auto 1.2rem;
          display: block;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
          transition: transform 0.3s;
        }
        .gender-card-btn:hover .gender-avatar-img {
          transform: scale(1.1);
        }

        .gender-card-title {
          font-family: 'Nunito', sans-serif;
          font-size: 1.4rem;
          font-weight: 900;
          margin-bottom: 0.4rem;
        }

        .boy-text {
          color: #3a9fe8;
        }
        .girl-text {
          color: #e8449a;
        }

        .gender-card-desc {
          font-size: 0.8rem;
          color: #94a3b8;
          line-height: 1.4;
        }

        /* Statuses & loading spinner */
        .status-container {
          padding: 2rem 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(100, 60, 200, 0.1);
          border-top-color: #3a9fe8;
          border-radius: 50%;
          animation: spin 1s infinite linear;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .status-text {
          font-size: 0.88rem;
          color: #64748b;
          font-weight: 600;
        }

        /* Success Card styles */
        .success-card {
          background: rgba(240, 253, 250, 0.8);
          border: 1px solid rgba(45, 212, 191, 0.3);
          border-radius: 20px;
          padding: 2.2rem;
          margin: 1rem 0;
        }
        .success-badge {
          display: inline-flex;
          background: #ccfbf1;
          color: #0d9488;
          padding: 0.4rem 1.1rem;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 700;
          margin-bottom: 1rem;
        }
        .success-card h2 {
          font-family: 'Nunito', sans-serif;
          font-size: 1.6rem;
          font-weight: 900;
          color: #115e59;
          margin: 0 0 0.5rem;
        }
        .success-card p {
          font-size: 0.9rem;
          color: #14b8a6;
          line-height: 1.6;
          margin: 0;
        }

        /* Error box styling */
        .error-card {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 16px;
          padding: 1.25rem;
          text-align: left;
          margin-top: 1.5rem;
        }
        .error-icon {
          font-size: 1.8rem;
        }
        .error-card h3 {
          margin: 0 0 0.2rem 0;
          color: #991b1b;
          font-size: 0.95rem;
          font-weight: 700;
        }
        .error-card p {
          margin: 0;
          color: #b91c1c;
          font-size: 0.85rem;
          line-height: 1.5;
        }

        /* Custom Confirmation Modal Backdrop & Content */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          animation: fadeIn 0.25s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .modal-content {
          background: white;
          border-radius: 24px;
          padding: 2.2rem;
          width: 90%;
          max-width: 460px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          text-align: center;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .modal-alert-icon {
          display: inline-flex;
          background: #f1f5f9;
          color: #475569;
          padding: 0.4rem 1rem;
          border-radius: 50px;
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 1.2rem;
        }

        .modal-content h3 {
          font-family: 'Nunito', sans-serif;
          font-size: 1.4rem;
          font-weight: 900;
          color: #1e293b;
          margin: 0 0 0.6rem 0;
        }

        .modal-content p {
          font-size: 0.88rem;
          color: #64748b;
          line-height: 1.6;
          margin: 0 0 1.8rem 0;
        }

        .modal-actions {
          display: grid;
          grid-template-columns: 1fr 1.3fr;
          gap: 0.75rem;
        }

        .modal-btn {
          padding: 0.88rem;
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .cancel-btn {
          background: #f1f5f9;
          color: #475569;
        }
        .cancel-btn:hover {
          background: #e2e8f0;
        }

        .confirm-btn {
          color: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .boy-confirm-bg {
          background: linear-gradient(135deg, #3a9fe8, #2563eb);
        }
        .boy-confirm-bg:hover {
          box-shadow: 0 6px 18px rgba(58, 159, 232, 0.35);
          transform: translateY(-1px);
        }

        .girl-confirm-bg {
          background: linear-gradient(135deg, #e8449a, #db2777);
        }
        .girl-confirm-bg:hover {
          box-shadow: 0 6px 18px rgba(232, 68, 154, 0.35);
          transform: translateY(-1px);
        }

        @media (max-width: 640px) {
          .portal-card {
            padding: 1.8rem;
          }
          .gender-grid {
            grid-template-columns: 1fr;
          }
          .gender-card-btn {
            padding: 1.8rem 1.2rem;
          }
        }
      `}</style>
    </main>
  );
}
