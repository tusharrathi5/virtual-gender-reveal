"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Heart } from "lucide-react";

const VirtualGenderRevealApp = dynamic(
  () => import("@/components/cinema/CinematicEntry"),
  { ssr: false }
);

interface AuthModalShellProps {
  title: string;
  subtitle: string;
  submitting: boolean;
  children: ReactNode;
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function AuthModalShell({ title, subtitle, submitting, children }: AuthModalShellProps) {
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    if (submitting) return;
    if (window.history.length > 1) router.back();
    else router.push("/");
  }, [router, submitting]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const modal = modalRef.current;
    const first = modal?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) return;
      const items = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previousFocusRef.current?.focus?.();
    };
  }, [close]);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        .auth-modal-page { min-height: 100vh; position: relative; overflow: hidden; font-family: 'Plus Jakarta Sans', sans-serif; }
        .auth-modal-bg { position: fixed; inset: 0; overflow: auto; filter: blur(6px); transform: scale(1.02); pointer-events: none; z-index: 5; }
        .auth-modal-shade { position: fixed; inset: 0; background: rgba(10, 11, 30, 0.72); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); z-index: 20; border: none; cursor: pointer; width: 100vw; height: 100vh; }
        .auth-modal-layer { position: fixed; inset: 0; z-index: 30; display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; overflow-y: auto; }
        
        .auth-card { 
          position: relative; 
          background: rgba(255, 255, 255, 0.95); 
          border-radius: 28px; 
          padding: 36px 40px; 
          width: min(540px, 100%); 
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.2), 0 0 40px rgba(232, 68, 154, 0.04); 
          border: 1px solid rgba(255, 255, 255, 0.7);
          overflow: hidden;
          backdrop-filter: blur(8px);
          margin: auto;
        }

        /* Ambient Glow Blobs */
        .glow-pink {
          position: absolute;
          top: -30px;
          left: -30px;
          width: 140px;
          height: 140px;
          background: radial-gradient(circle, rgba(232, 68, 154, 0.18) 0%, rgba(232, 68, 154, 0) 70%);
          filter: blur(20px);
          pointer-events: none;
          z-index: 0;
        }

        .glow-blue {
          position: absolute;
          bottom: -30px;
          right: -30px;
          width: 140px;
          height: 140px;
          background: radial-gradient(circle, rgba(58, 159, 232, 0.18) 0%, rgba(58, 159, 232, 0) 70%);
          filter: blur(20px);
          pointer-events: none;
          z-index: 0;
        }

        .auth-close { 
          position: absolute; 
          top: 20px; 
          right: 20px; 
          width: 32px; 
          height: 32px; 
          border: 1px solid #f1f1f5; 
          background: white; 
          color: #6b7280; 
          font-size: 20px; 
          line-height: 1; 
          cursor: pointer; 
          border-radius: 50%; 
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          z-index: 10;
        }
        .auth-close:hover:not(:disabled), .auth-close:focus-visible { 
          background: #fafafd; 
          color: #111827;
          border-color: #d1d5db;
          outline: none; 
          transform: scale(1.05);
        }
        .auth-close:disabled { opacity: .45; cursor: not-allowed; }
        
        .auth-logo-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          margin-bottom: 20px;
          position: relative;
          z-index: 1;
        }

        .brand-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-bottom: 8px;
        }

        .auth-logo { 
          font-family: 'Nunito', sans-serif;
          font-size: 24px; 
          font-weight: 800; 
          color: #111827; 
          letter-spacing: -0.02em;
        }

        .auth-brand-badge {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          background: linear-gradient(135deg, #E8449A, #3A9FE8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 6px;
        }

        .auth-subtitle { 
          font-size: 13px; 
          color: #6b7280; 
          font-weight: 600;
        }

        .auth-content-body {
          position: relative;
          z-index: 1;
        }

        @media (max-width: 580px) {
          .auth-modal-layer { align-items: flex-start; padding: 12px; }
          .auth-card { padding: 28px 20px 24px; border-radius: 24px; }
          .auth-close { top: 16px; right: 16px; }
        }
      `}</style>
      <div className="auth-modal-page">
        <div className="auth-modal-bg" aria-hidden="true">
          <VirtualGenderRevealApp />
        </div>
        <button className="auth-modal-shade" aria-label="Close authentication dialog" onClick={close} disabled={submitting} />
        <div className="auth-modal-layer" role="presentation">
          <div ref={modalRef} className="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" onClick={(e) => e.stopPropagation()}>
            <button className="auth-close" onClick={close} disabled={submitting} aria-label="Close">×</button>
            
            <div className="auth-logo-area">
              <div className="w-12 h-12 rounded-2xl bg-white border border-[#f1f1f5] flex items-center justify-center shadow-md shadow-[#00000008] mb-3 hover:scale-105 transition-transform duration-300">
                <img src="/Favicon-VGR.png" alt="VGR Logo" className="w-8 h-8 object-contain" />
              </div>
              <span className="auth-brand-badge">Virtual Gender Reveal</span>
              <div className="brand-icon-wrap">
                <h1 id="auth-modal-title" className="auth-logo bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] bg-clip-text text-transparent font-extrabold">{title}</h1>
              </div>
              <p className="auth-subtitle">{subtitle}</p>
            </div>

            <div className="glow-pink" />
            <div className="glow-blue" />

            <div className="auth-content-body">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
