"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

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
        .auth-modal-page { min-height: 100vh; position: relative; overflow: hidden; }
        .auth-modal-bg { position: fixed; inset: 0; overflow: auto; filter: blur(4px); transform: scale(1.01); pointer-events: none; }
        .auth-modal-shade { position: fixed; inset: 0; background: rgba(17,24,39,0.56); backdrop-filter: blur(2px); z-index: 20; }
        .auth-modal-layer { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; padding: 24px; overflow: auto; }
        .auth-card { position: relative; background: white; border-radius: 16px; padding: 40px; width: min(440px, 100%); box-shadow: 0 24px 70px rgba(0,0,0,0.28); }
        .auth-close { position: absolute; top: 12px; right: 14px; width: 34px; height: 34px; border: 0; background: transparent; color: #374151; font-size: 28px; line-height: 1; cursor: pointer; border-radius: 50%; }
        .auth-close:hover:not(:disabled), .auth-close:focus-visible { background: #f3f4f6; outline: none; }
        .auth-close:disabled { opacity: .45; cursor: not-allowed; }
        .auth-logo { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 8px; }
        .auth-subtitle { font-size: 14px; color: #6b7280; margin-bottom: 32px; }
        @media (max-width: 520px) {
          .auth-modal-layer { align-items: flex-start; padding: 16px; }
          .auth-card { padding: 32px 22px 24px; margin-top: 24px; }
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
            <div id="auth-modal-title" className="auth-logo">{title}</div>
            <p className="auth-subtitle">{subtitle}</p>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}


