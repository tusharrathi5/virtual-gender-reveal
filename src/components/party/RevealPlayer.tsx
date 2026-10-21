"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Volume2 } from "lucide-react";

// Player controls stay hidden while the reveal plays out for everyone together.
const CONTROLS_DELAY_SECONDS = 180;
// Guests on the page at reveal time see "live" a few seconds late (poll + player load);
// start them at 0 rather than skipping the opening.
const START_GRACE_SECONDS = 15;
// Seek cap when the clip duration is unknown, so late joiners never land past the end
// (Cloudflare renders that as a black frame).
const FALLBACK_MAX_SECONDS = 180;
// A browser that refuses an unmute pauses the video right away; a pause this soon after
// unmuting is treated as a refusal.
const UNMUTE_REFUSAL_WINDOW_MS = 1500;
const SDK_LOAD_TIMEOUT_MS = 4000;
const SDK_URL = "https://embed.cloudflarestream.com/embed/sdk.latest.js";

type StreamPlayer = {
  muted: boolean;
  controls: boolean;
  play: () => Promise<void>;
  addEventListener: (event: string, handler: () => void) => void;
  destroy: () => void;
};

declare global {
  interface Window {
    Stream?: (iframe: HTMLIFrameElement) => StreamPlayer;
  }
}

let sdkPromise: Promise<void> | null = null;

/** Loads Cloudflare's Stream Player SDK once; safe to call early to warm it up. */
export function loadStreamSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Stream) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        sdkPromise = null;
        reject(new Error("Stream SDK failed to load"));
      };
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

/** iOS only allows sound from a tap at playback time, so we don't try to unmute there. */
export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Whether the guest has tapped/clicked/typed on the page (helps some browsers allow sound). */
export function useHasInteracted(): boolean {
  const [hasInteracted, setHasInteracted] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { userActivation?: { hasBeenActive: boolean } };
    if (nav.userActivation?.hasBeenActive) {
      setHasInteracted(true);
      return;
    }
    // "click" rather than "pointerdown": the state change swaps the sound prompt for a
    // shorter line, and doing that mid-tap shifts the layout so the tap misses the button
    // it started on (e.g. "Watch on a Bigger Screen").
    const mark = () => setHasInteracted(true);
    window.addEventListener("click", mark, { once: true });
    window.addEventListener("keydown", mark, { once: true });
    return () => {
      window.removeEventListener("click", mark);
      window.removeEventListener("keydown", mark);
    };
  }, []);
  return hasInteracted;
}

function getStreamUid(videoUrl: string): string {
  // Only a real Stream uid (32 hex chars) counts; a length check alone matched the
  // Firebase path segment "static%2Fvideos%2Fboy_reveal.mov", which is also 32 chars.
  for (const part of videoUrl.split("/")) {
    const cleaned = part.replace(/\?.*/, "");
    if (/^[a-f0-9]{32}$/i.test(cleaned)) return cleaned;
  }
  return "";
}

function secondsSince(iso: string | null): number {
  return iso ? (Date.now() - new Date(iso).getTime()) / 1000 : 0;
}

function syncedStartSeconds(revealAtIso: string | null): number {
  const elapsed = secondsSince(revealAtIso);
  return elapsed <= START_GRACE_SECONDS ? 0 : elapsed;
}

/** The bits of a Stream player or a <video> element the sound logic needs. */
type MediaHandle = {
  setMuted: (muted: boolean) => void;
  play: () => Promise<void>;
};

type Props = {
  videoUrl: string;
  revealAtIso: string | null;
  videoDurationSeconds: number | null;
};

/**
 * Plays the reveal in sync for every guest. Browsers only allow autoplay muted (and
 * Cloudflare's player silently mutes itself if asked to autoplay with sound), so it always
 * starts muted and unmutes once playback is running, which desktop Chrome/Edge allow.
 * Where the browser refuses (it pauses the video), it re-mutes, resumes, and offers
 * "Tap for sound".
 */
export default function RevealPlayer({ videoUrl, revealAtIso, videoDurationSeconds }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRef = useRef<MediaHandle | null>(null);
  const playerRef = useRef<StreamPlayer | null>(null);
  const pauseListenersRef = useRef<Array<() => void>>([]);
  const autoUnmuteTriedRef = useRef(false);

  const streamUid = useMemo(() => getStreamUid(videoUrl), [videoUrl]);

  const [sdkState, setSdkState] = useState<"loading" | "ready" | "failed">(() =>
    typeof window !== "undefined" && window.Stream ? "ready" : "loading"
  );
  useEffect(() => {
    if (!streamUid || sdkState !== "loading") return;
    const timeout = setTimeout(() => setSdkState((s) => (s === "loading" ? "failed" : s)), SDK_LOAD_TIMEOUT_MS);
    loadStreamSdk()
      .then(() => setSdkState("ready"))
      .catch(() => setSdkState("failed"))
      .finally(() => clearTimeout(timeout));
    return () => clearTimeout(timeout);
  }, [streamUid, sdkState]);

  const [controlsUnlocked, setControlsUnlocked] = useState(
    () => secondsSince(revealAtIso) >= CONTROLS_DELAY_SECONDS
  );
  useEffect(() => {
    if (controlsUnlocked || !revealAtIso) return;
    const remainingMs = (CONTROLS_DELAY_SECONDS - secondsSince(revealAtIso)) * 1000;
    const timer = setTimeout(() => setControlsUnlocked(true), Math.max(0, remainingMs));
    return () => clearTimeout(timer);
  }, [controlsUnlocked, revealAtIso]);
  // Last resort when the browser refuses sound even from a tap (iOS): show the player's
  // own controls so the guest can unmute from inside it.
  const [forcedControls, setForcedControls] = useState(false);
  const showControls = controlsUnlocked || forcedControls;
  const showControlsRef = useRef(showControls);
  showControlsRef.current = showControls;

  const [soundOn, setSoundOn] = useState(false);

  // Where the player starts, decided once per video so later changes (sound, controls
  // unlocking) adjust the running player instead of reloading it.
  const sdkResolved = sdkState !== "loading";
  const sdkAvailable = sdkState === "ready";
  const initial = useMemo(() => {
    const start = Math.floor(syncedStartSeconds(revealAtIso));
    const maxSeconds = videoDurationSeconds ?? FALLBACK_MAX_SECONDS;
    const pastEnd = start >= maxSeconds;
    return {
      pastEnd,
      startSeconds: pastEnd ? Math.max(0, Math.floor(maxSeconds) - 1) : start,
      controls: secondsSince(revealAtIso) >= CONTROLS_DELAY_SECONDS,
    };
  }, [revealAtIso, videoDurationSeconds]);

  const embedUrl = useMemo(() => {
    if (!streamUid || !sdkResolved) return "";
    // The player treats a present `autoplay` param as on even when it's "false" (a late
    // joiner given autoplay=false still played), so off flags are left out entirely.
    const params = new URLSearchParams({ startTime: String(initial.startSeconds) });
    if (!initial.pastEnd) {
      params.set("autoplay", "true");
      params.set("muted", "true");
    }
    // Without the SDK we can't unmute or reveal controls later, so start with controls.
    params.set("controls", String(initial.controls || !sdkAvailable));
    return `https://iframe.videodelivery.net/${streamUid}?${params.toString()}`;
  }, [streamUid, sdkResolved, sdkAvailable, initial]);

  /** Unmutes; if the browser answers by pausing, re-mutes and resumes instead. */
  const tryUnmute = useCallback((onRefused: () => void) => {
    const media = mediaRef.current;
    if (!media) return onRefused();
    let refused = false;
    const refuse = () => {
      if (refused) return;
      refused = true;
      media.setMuted(true);
      setSoundOn(false);
      media.play().catch(() => {});
      onRefused();
    };
    const watcher = () => refuse();
    pauseListenersRef.current.push(watcher);
    setTimeout(() => {
      pauseListenersRef.current = pauseListenersRef.current.filter((l) => l !== watcher);
    }, UNMUTE_REFUSAL_WINDOW_MS);
    media.setMuted(false);
    setSoundOn(true);
    media.play().catch(refuse);
  }, []);

  const handlePlaying = useCallback(() => {
    if (autoUnmuteTriedRef.current) return;
    autoUnmuteTriedRef.current = true;
    if (isIOSDevice() || initial.pastEnd) return;
    tryUnmute(() => {});
  }, [tryUnmute, initial]);

  // A pause also fires when the clip reaches its end (just before "ended"), which must
  // not count as the browser refusing sound; check shortly after whether it ended.
  const endedRef = useRef(false);
  const handlePause = useCallback(() => {
    setTimeout(() => {
      if (!endedRef.current) pauseListenersRef.current.forEach((l) => l());
    }, 250);
  }, []);
  const handleEnded = useCallback(() => {
    endedRef.current = true;
  }, []);

  // Attach the SDK to the iframe as soon as it exists (before its "iframeReady" handshake).
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !embedUrl || !sdkAvailable || !window.Stream) return;
    const player = window.Stream(iframe);
    let destroyed = false;
    mediaRef.current = {
      setMuted: (muted) => {
        player.muted = muted;
      },
      play: () => player.play(),
    };
    player.addEventListener("playing", () => {
      if (!destroyed) handlePlaying();
    });
    player.addEventListener("pause", () => {
      if (!destroyed) handlePause();
    });
    player.addEventListener("ended", () => {
      if (!destroyed) handleEnded();
    });
    if (showControlsRef.current) player.controls = true;
    playerRef.current = player;
    return () => {
      destroyed = true;
      player.destroy();
      if (playerRef.current === player) playerRef.current = null;
      mediaRef.current = null;
    };
  }, [embedUrl, sdkAvailable, handlePlaying, handlePause, handleEnded]);

  useEffect(() => {
    if (showControls && playerRef.current) playerRef.current.controls = true;
  }, [showControls]);

  // Seek a plain <video> to the shared reveal timeline, like startTime does for the
  // Cloudflare player; past the end, rest on the last frame.
  const syncDirectVideo = useCallback(
    (video: HTMLVideoElement) => {
      mediaRef.current = {
        setMuted: (muted) => {
          video.muted = muted;
        },
        play: () => video.play(),
        };
      const elapsed = syncedStartSeconds(revealAtIso);
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      if (duration != null && elapsed >= duration - 1) {
        video.currentTime = Math.max(0, duration - 0.5);
        video.pause();
        return;
      }
      video.currentTime = Math.max(0, elapsed);
      video.muted = true;
      video.play().catch(() => {});
    },
    [revealAtIso]
  );

  const enableSound = useCallback(() => {
    tryUnmute(() => setForcedControls(true));
  }, [tryUnmute]);

  const showSoundButton = !soundOn && !showControls && !initial.pastEnd && (!streamUid || sdkAvailable);

  return (
    <>
      {streamUid ? (
        embedUrl ? (
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title="Reveal Video"
            className="w-full h-full border-0"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" aria-hidden="true">
            <div className="w-8 h-8 rounded-full border-4 border-white/20 border-t-white animate-spin" />
          </div>
        )
      ) : (
        <video
          ref={videoRef}
          src={videoUrl}
          title="Reveal Video"
          className="w-full h-full bg-black"
          muted
          playsInline
          controls={showControls}
          preload="auto"
          onLoadedMetadata={(e) => syncDirectVideo(e.currentTarget)}
          onPlaying={handlePlaying}
          onPause={handlePause}
          onEnded={handleEnded}
        />
      )}

      {showSoundButton && (
        <div className="absolute left-4 bottom-4 z-30">
          <button
            type="button"
            onClick={enableSound}
            className="px-3 py-1.5 bg-slate-950/85 hover:bg-slate-950 backdrop-blur-md rounded-xl border border-white/20 text-white shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-black animate-pulse"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#E8449A]" />
            Tap for sound
          </button>
        </div>
      )}
    </>
  );
}
