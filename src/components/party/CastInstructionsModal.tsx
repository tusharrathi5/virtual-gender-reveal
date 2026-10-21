"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Lightbulb, Tv, X } from "lucide-react";

type Platform = "ios" | "android" | "windows" | "mac";

type Guide = {
  label: string;
  heading: string;
  steps: ReactNode[];
  note?: string;
};

const GUIDES: Record<Platform, Guide> = {
  ios: {
    label: "iPhone / iPad",
    heading: "Using AirPlay / Screen Mirroring",
    steps: [
      "Connect your iPhone or iPad and compatible TV to the same Wi-Fi network.",
      <>Open <strong>Control Center</strong> by swiping down from the top-right corner (or up from the bottom on older devices).</>,
      <>Tap <strong>Screen Mirroring</strong>.</>,
      "Select your Apple TV or AirPlay-compatible smart TV.",
      "Keep your reveal countdown open and enjoy the big moment!",
    ],
  },
  android: {
    label: "Android",
    heading: "Using Cast / Screen Mirroring",
    steps: [
      "Connect your Android device and compatible TV to the same Wi-Fi network.",
      "Swipe down to open Quick Settings.",
      <>Look for <strong>Cast</strong>, <strong>Screen Cast</strong>, or <strong>Smart View</strong> (names vary by device).</>,
      "Select your TV and follow any on-screen prompts.",
      "Return to your reveal countdown and enjoy!",
    ],
    note: "For Chromecast or Google TV, you can also use the Google Home app's Cast screen option.",
  },
  windows: {
    label: "Windows PC",
    heading: "Using Wireless Display",
    steps: [
      "Turn on your TV and enable screen mirroring or wireless display if supported.",
      <>Press <strong>Windows + K</strong> on your PC.</>,
      "Select your compatible TV from the available devices.",
      "Follow any connection prompts.",
      "Keep your browser open on the reveal countdown.",
    ],
    note: "You can also connect your computer to the TV using an HDMI cable.",
  },
  mac: {
    label: "Mac",
    heading: "Using AirPlay / Screen Mirroring",
    steps: [
      "Connect your Mac and AirPlay-compatible TV to the same Wi-Fi network.",
      <>Click <strong>Control Center</strong> in your Mac&apos;s menu bar.</>,
      <>Select <strong>Screen Mirroring</strong>.</>,
      "Choose your TV and follow any prompts.",
      "Display your reveal countdown on the shared screen.",
    ],
  },
};

const PLATFORM_ORDER: Platform[] = ["ios", "android", "windows", "mac"];

/** Best guess at the viewer's platform so the right steps show first. */
function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "ios";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Mac/i.test(ua)) return "mac";
  if (/Win/i.test(ua)) return "windows";
  return "ios";
}

export default function CastInstructionsModal({ onClose }: { onClose: () => void }) {
  const [platform, setPlatform] = useState<Platform>(detectPlatform);
  const guide = GUIDES[platform];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center z-[999] p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cast-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white/95 backdrop-blur-2xl rounded-[24px] border border-white/60 p-6 md:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in flex flex-col gap-5 text-left"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col gap-2 pr-8">
          <h3 id="cast-modal-title" className="flex items-center gap-2 text-lg md:text-xl font-nunito font-extrabold text-slate-800">
            <Tv className="w-5 h-5 text-[#E8449A] shrink-0" />
            Make the Big Reveal Even Bigger!
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Share the excitement with everyone! Display your countdown and reveal on a TV or bigger screen in just a few easy steps.
          </p>
        </div>

        <div role="radiogroup" aria-label="Your device" className="grid grid-cols-2 gap-2">
          {PLATFORM_ORDER.map((key) => {
            const selected = key === platform;
            return (
              <label
                key={key}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm font-bold cursor-pointer transition-all ${
                  selected
                    ? "border-[#E8449A] bg-[#E8449A]/5 text-slate-800 shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="cast-platform"
                  value={key}
                  checked={selected}
                  onChange={() => setPlatform(key)}
                  className="w-4 h-4 accent-[#E8449A] cursor-pointer"
                />
                {GUIDES[key].label}
              </label>
            );
          })}
        </div>

        <div className="border-t border-slate-200 pt-5 flex flex-col gap-3">
          <h4 className="text-sm md:text-base font-extrabold text-slate-800">{guide.heading}</h4>
          <ol className="flex flex-col gap-2 text-sm text-slate-600 leading-relaxed">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="shrink-0 w-5 h-5 mt-0.5 rounded-full bg-gradient-to-br from-[#E8449A] to-[#3A9FE8] text-white text-[11px] font-black flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="[&_strong]:font-bold [&_strong]:text-slate-800">{step}</span>
              </li>
            ))}
          </ol>
          {guide.note && <p className="text-xs text-slate-400">{guide.note}</p>}
        </div>

        <div className="rounded-2xl border border-[#3A9FE8]/20 bg-[#3A9FE8]/5 px-4 py-3 flex flex-col gap-1">
          <p className="flex items-center gap-1.5 text-sm font-extrabold text-slate-800">
            <Lightbulb className="w-4 h-4 text-[#3A9FE8]" />
            A little tip!
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            Set up your screen a few minutes early, turn up the volume, and keep your device connected so everyone can enjoy the surprise together!
          </p>
        </div>

        <p className="text-center text-xs text-slate-400">Casting depends on your device and TV compatibility.</p>
      </div>
    </div>
  );
}
