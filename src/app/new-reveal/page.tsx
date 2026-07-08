"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { v4 as uuidv4 } from "uuid";
import { uploadPhotos, validatePhotoFiles } from "@/lib/storageService";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase";
import {
  PHOTO_MAX,
  type EnquiryMode,
  type GenderValue,
  type RevealerRelation,
} from "@/lib/types";
import DashboardShell from "@/components/dashboard/DashboardShell";
import {
  Sparkles,
  Plus,
  Trash2,
  Calendar,
  Mail,
  User,
  AlertCircle,
  Camera,
  Heart,
  ChevronDown,
} from "lucide-react";



// ─── Helpers ────────────────────────────────────────────────

// All US timezones in priority order (grouped at top of dropdown)
const US_TIMEZONES: { value: string; label: string; short: string }[] = [
  { value: "America/New_York",    label: "Eastern Time",  short: "ET" },
  { value: "America/Chicago",     label: "Central Time",  short: "CT" },
  { value: "America/Denver",      label: "Mountain Time", short: "MT" },
  { value: "America/Phoenix",     label: "Arizona (no DST)", short: "MST" },
  { value: "America/Los_Angeles", label: "Pacific Time",  short: "PT" },
  { value: "America/Anchorage",   label: "Alaska Time",   short: "AKT" },
  { value: "Pacific/Honolulu",    label: "Hawaii Time",   short: "HT" },
];

const US_TIMEZONE_VALUES = new Set(US_TIMEZONES.map((t) => t.value));
const DEFAULT_US_TIMEZONE = "America/New_York";

// Auto-detect browser timezone; if not US, default to Eastern Time
function getInitialTimezone(): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected && US_TIMEZONE_VALUES.has(detected)) {
      return detected;
    }
    return DEFAULT_US_TIMEZONE;
  } catch {
    return DEFAULT_US_TIMEZONE;
  }
}

// Get all IANA timezones the browser supports — falls back to US-only if unsupported
function getAllTimezones(): string[] {
  try {
    const supported = (Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    }).supportedValuesOf;
    if (typeof supported === "function") {
      return supported("timeZone").sort();
    }
  } catch {
    // fall through
  }
  return US_TIMEZONES.map((t) => t.value);
}

// Format a timezone for display in the dropdown
function formatTimezone(tz: string): string {
  const us = US_TIMEZONES.find((t) => t.value === tz);
  if (us) return `${us.label} (${us.short})`;
  const parts = tz.split("/");
  if (parts.length >= 2) {
    const city = parts[parts.length - 1].replace(/_/g, " ");
    const region = parts[0];
    return `${city} (${region})`;
  }
  return tz;
}

function getMinDateTime(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const RELATION_LABELS: Record<RevealerRelation, string> = {
  doctor: "Doctor / Midwife",
  relative: "Relative",
  friend: "Friend",
  other: "Other",
};

function formatRevealDate(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Component ──────────────────────────────────────────────

export default function NewRevealPage() {
  const { user, firestoreUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [error, setError] = useState("");
  const [entitlementChecked, setEntitlementChecked] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdDownloadUrl, setCreatedDownloadUrl] = useState("");
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const isBasicPlan = (firestoreUser?.activePlan ?? "none") === "basic" || (firestoreUser?.activePlan ?? "none") === "free";

  // Entitlement guard: redirect if user can't create a reveal
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setEntitlementChecked(false);
      router.replace("/login?redirect=/new-reveal");
      return;
    }

    let cancelled = false;
    setEntitlementChecked(false);

    void (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/entitlement/can-create", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data?.canCreate) {
          router.replace("/dashboard?noEntitlement=1");
          return;
        }
        setEntitlementChecked(true);
      } catch {
        if (!cancelled) router.replace("/dashboard?noEntitlement=1");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, router]);

  // Shared fields
  const [mode, setMode] = useState<EnquiryMode>("reveal");
  const [parentName, setParentName] = useState("");
  const [revealAt, setRevealAt] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  // Announcement mode fields

  const [announcementGender, setAnnouncementGender] = useState<GenderValue | null>(null);

  // Reveal mode fields
  const [revealerName, setRevealerName] = useState("");
  const [revealerEmail, setRevealerEmail] = useState("");
  const [revealerRelation, setRevealerRelation] = useState<RevealerRelation>("doctor");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [timezone, setTimezone] = useState<string>(() => getInitialTimezone());
  const [tzSearch, setTzSearch] = useState("");
  const [tzDropdownOpen, setTzDropdownOpen] = useState(false);
  const tzDropdownRef = useRef<HTMLDivElement>(null);
  const minDateTime = useMemo(() => getMinDateTime(), []);

  // All timezones for the search list
  const allTimezones = useMemo(() => getAllTimezones(), []);

  // Filter timezones based on search
  const filteredWorldTimezones = useMemo(() => {
    const q = tzSearch.trim().toLowerCase();
    if (!q) return allTimezones.filter((tz) => !US_TIMEZONE_VALUES.has(tz));
    return allTimezones.filter(
      (tz) =>
        !US_TIMEZONE_VALUES.has(tz) &&
        (tz.toLowerCase().includes(q) ||
          formatTimezone(tz).toLowerCase().includes(q))
    );
  }, [tzSearch, allTimezones]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!tzDropdownOpen) return;
    function onClick(e: MouseEvent) {
      if (tzDropdownRef.current && !tzDropdownRef.current.contains(e.target as Node)) {
        setTzDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [tzDropdownOpen]);

  // Preview URLs for selected photos with proper cleanup
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  useEffect(() => {
    const urls = photoFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoFiles]);

  // Progress steps (non-blocking)
  const steps = useMemo(() => {
    const isStep1Complete = !!mode;
    const isStep2Complete =
      !!parentName.trim() &&
      (mode === "announcement"
        ? !!announcementGender
        : !!revealerEmail.trim() &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(revealerEmail.trim()) &&
          !!revealerName.trim());

    const isStep3Complete = !!revealAt;
    return [
      { label: "Reveal Type", isComplete: isStep1Complete },
      { label: "Family Details", isComplete: isStep2Complete },
      { label: "Reveal Schedule", isComplete: isStep3Complete },
    ];
  }, [mode, parentName, announcementGender, revealerEmail, revealerName, revealAt]);

  // ─── Photo handlers ──────────────────────────────────────

  function handlePhotoSlotClick() {
    if (photoFiles.length >= PHOTO_MAX) return;
    fileInputRef.current?.click();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const combined = [...photoFiles, ...files].slice(0, PHOTO_MAX);
    const validation = validatePhotoFiles(combined);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setError("");
    setPhotoFiles(combined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setError("");
  }

  // ─── Validation ──────────────────────────────────────────

  function validateForm(): string | null {
    if (!parentName.trim()) return "Please enter the parent name(s).";

    if (mode === "reveal") {
      if (!revealAt) return "Please pick a reveal date and time.";
      const revealDate = new Date(revealAt);
      if (isNaN(revealDate.getTime())) return "Invalid reveal date.";
      if (revealDate.getTime() < Date.now() + 30 * 60 * 1000) {
        return "Reveal time must be at least 30 minutes in the future.";
      }
    }

    if (!isBasicPlan) {
      const photoValidation = validatePhotoFiles(photoFiles);
      if (!photoValidation.ok) return photoValidation.error;
    }

    if (mode === "announcement") {
      if (!announcementGender) return "Please select the baby's gender.";
    } else {
      if (!revealerName.trim()) return "Please enter the revealer's name.";
      if (!revealerEmail.trim()) return "Please enter the revealer's email.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(revealerEmail.trim())) {
        return "Please enter a valid revealer email.";
      }
    }

    return null;
  }

  // ─── Submit ──────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setError("You must be logged in.");
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setLoading(true);
    setUploadProgress("Preparing your reveal…");

    const enquiryId = uuidv4();

    try {
      const effectivePhotoFiles = isBasicPlan ? [] : photoFiles;
      setUploadProgress(
        effectivePhotoFiles.length > 0
          ? `Uploading ${effectivePhotoFiles.length} photo${effectivePhotoFiles.length > 1 ? "s" : ""}...`
          : "Saving without photos..."
      );
      const photoUrls = effectivePhotoFiles.length > 0 ? await uploadPhotos(enquiryId, effectivePhotoFiles) : [];

      setUploadProgress("Saving your reveal details…");
      const idToken = await user.getIdToken();

      const res = await fetch("/api/create-reveal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          enquiryId,
          mode,
          parentName: parentName.trim(),
          photos: [],
          revealAtMs: mode === "announcement" ? Date.now() : new Date(revealAt).getTime(),
          revealTimezone: mode === "announcement" ? "UTC" : timezone,
          dueDate: null,
          // Announcement mode
          babyName: null,
          announcementGender: mode === "announcement" ? announcementGender : undefined,
          // Reveal mode


          revealerEmail: mode === "reveal" ? revealerEmail.trim().toLowerCase() : undefined,
          revealerRelation: mode === "reveal" ? revealerRelation : undefined,
          revealerName: mode === "reveal" ? revealerName.trim() : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to create reveal. Please try again.");
      }

      if (isBasicPlan && mode === "announcement" && announcementGender) {
        setUploadProgress("");
        setLoading(false);
        setShowSuccessModal(true);
        setResolvingUrl(true);
        try {
          const storage = getFirebaseStorage();
          const fileRef = storageRef(storage, `static/videos/${announcementGender}_reveal.mov`);
          const url = await getDownloadURL(fileRef);
          setCreatedDownloadUrl(url);
        } catch (err) {
          console.error("Failed client-side getDownloadURL:", err);
          setCreatedDownloadUrl(`https://firebasestorage.googleapis.com/v0/b/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/o/static%2Fvideos%2F${announcementGender}_reveal.mov?alt=media`);
        } finally {
          setResolvingUrl(false);
        }
      } else {
        setUploadProgress("Finishing up…");
        router.push(`/dashboard?created=${enquiryId}`);
      }
    } catch (err) {
      console.error("Reveal creation error:", err);
      const msg =
        (err as { message?: string })?.message ??
        "Something went wrong. Please try again.";
      setError(msg);
      setLoading(false);
      setUploadProgress("");
    }
  }

  // ─── Render ──────────────────────────────────────────────

  const summaryCardComponent = useMemo(() => {
    return (
      <div className="lg:sticky lg:top-24 space-y-6">
        <div className="bg-white/40 backdrop-blur-md border border-white/30 rounded-2xl p-6 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#E8449A]/5 to-[#3A9FE8]/5 rounded-full blur-2xl -z-10" />

          <h3 className="font-nunito font-extrabold text-lg text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
            <Sparkles className="w-5 h-5 text-[#E8449A]" />
            Reveal Summary
          </h3>

          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Event Type</span>
              <span className="font-bold text-gray-800 flex items-center gap-1.5 mt-0.5">
                {mode === "reveal" ? "🎀 Gender Reveal" : "📣 Gender Announcement"}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Parent Name(s)</span>
              <span className="font-semibold text-gray-800 mt-0.5 block truncate">
                {parentName.trim() || <span className="text-gray-300 italic font-normal">Not set</span>}
              </span>
            </div>

            {mode === "announcement" && (
              <>
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Baby's Gender</span>
                  <span className="font-semibold text-gray-800 mt-0.5 block">
                    {announcementGender === "boy" ? "💙 Boy" : announcementGender === "girl" ? "🩷 Girl" : <span className="text-gray-300 italic font-normal">Not selected</span>}
                  </span>
                </div>
              </>
            )}

            {mode === "reveal" && (
              <>
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Revealer Contact</span>
                  <span className="font-semibold text-gray-800 mt-0.5 block truncate">
                    {revealerEmail.trim() || <span className="text-gray-300 italic font-normal">Not set</span>}
                  </span>
                  {revealerEmail && (
                    <span className="text-xs text-gray-500 block mt-0.5 font-medium">
                      Relation: {RELATION_LABELS[revealerRelation]}
                    </span>
                  )}
                </div>
              </>
            )}

            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Reveal Schedule</span>
              <span className="font-semibold text-gray-800 mt-0.5 block">
                {revealAt ? formatRevealDate(new Date(revealAt)) : <span className="text-gray-300 italic font-normal">Not scheduled</span>}
              </span>
              <span className="text-xs text-gray-500 block mt-0.5 truncate font-medium">
                Timezone: {formatTimezone(timezone)}
              </span>
            </div>




          </div>
        </div>
      </div>
    );
  }, [mode, parentName, announcementGender, revealerEmail, revealerRelation, revealAt, timezone, isBasicPlan]);

  if (authLoading || !user || !entitlementChecked) {
    return (
      <DashboardShell activeTab="create" title="Create Your Reveal">
        <div className="bg-white/40 backdrop-blur-md border border-white/30 rounded-2xl p-8 shadow-sm max-w-2xl mx-auto mt-10">
          <p className="text-gray-500 font-medium text-center">Checking your payment status…</p>
        </div>
        {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40 backdrop-blur-[4px]">
          <div className="bg-white/75 backdrop-blur-md border border-white/40 rounded-[24px] p-8 max-w-md w-full shadow-2xl relative text-center animate-scale-in">
            <div className="w-16 h-16 bg-gradient-to-tr from-[#E8449A]/20 to-[#3A9FE8]/20 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🎉</div>
            <h3 className="font-nunito font-extrabold text-xl bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] bg-clip-text text-transparent mb-2">Reveal Created Successfully!</h3>
            <p className="text-xs text-gray-500 font-semibold mb-6 leading-relaxed">
              Your virtual gender reveal is ready. Click below to download your custom reveal video.
            </p>
            {resolvingUrl ? (
              <div className="py-3 text-sm text-gray-500 font-bold animate-pulse">Generating secure download link...</div>
            ) : createdDownloadUrl ? (
              <a
                href={createdDownloadUrl}
                download="gender_reveal.mov"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 px-4 bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white rounded-xl text-sm font-bold tracking-wider uppercase shadow-md hover:opacity-95 active:scale-[0.98] transition-all mb-3 text-center"
              >
                Download Video (.MOV)
              </a>
            ) : (
              <div className="text-xs text-red-500 font-bold mb-3">Video file not found in storage.</div>
            )}
            <button
              onClick={() => {
                setShowSuccessModal(false);
                router.push("/dashboard");
              }}
              className="block w-full py-2.5 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </DashboardShell>
    );
  }

  return (
    <DashboardShell activeTab="create" title="Create Your Reveal">
      <div className="w-full relative">
        <style>{`
          @keyframes floatUp {
            0% {
              transform: translateY(110vh) rotate(0deg);
              opacity: 0;
            }
            10% {
              opacity: 0.9;
            }
            90% {
              opacity: 0.9;
            }
            100% {
              transform: translateY(-20vh) rotate(360deg);
              opacity: 0;
            }
          }
          .animate-float-balloon {
            animation: floatUp 6s linear forwards;
          }
        `}</style>

        {loading && (
          <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
            {Array.from({ length: 16 }).map((_, i) => {
              const left = `${5 + i * 6}%`;
              const delay = `${i * 0.35}s`;
              const duration = `${5 + Math.random() * 3}s`;
              const size = `${30 + Math.random() * 30}px`;
              const color = i % 2 === 0 ? "bg-[#E8449A]" : "bg-[#3A9FE8]";
              return (
                <div
                  key={i}
                  className={`absolute bottom-0 rounded-full animate-float-balloon ${color}`}
                  style={{
                    left,
                    width: size,
                    height: "calc(" + size + " * 1.2)",
                    animationDelay: delay,
                    animationDuration: duration,
                    borderRadius: "50% 50% 50% 50% / 40% 40% 60% 60%",
                  }}
                >
                  <div className="absolute bottom-0 left-1/2 w-0.5 h-6 bg-gray-300 -translate-x-1/2 translate-y-full" />
                </div>
              );
            })}
          </div>
        )}

        {/* Background Image for Create Reveal Page (Desktop vs Mobile) */}
        <img
          src="/images/reveal-page-background.png"
          alt="Create Reveal Background"
          className="hidden md:block fixed inset-0 w-full h-full object-cover z-0 pointer-events-none"
        />
        <img
          src="/images/reveal_image_mobile.jpeg"
          alt="Create Reveal Background Mobile"
          className="block md:hidden fixed inset-0 w-full h-full object-cover z-0 pointer-events-none"
        />
        <div className="relative z-10">
        {/* Page Introduction */}
        <div className="mb-8 text-center flex flex-col items-center justify-center">
          <h1 className="font-nunito font-extrabold text-3xl md:text-4xl tracking-tight bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] bg-clip-text text-transparent mb-2 text-center">
            Create Your Reveal
          </h1>
          <p className="text-sm md:text-base text-gray-500 max-w-2xl leading-relaxed font-medium text-center mx-auto">
            Complete the quick steps below and we&apos;ll handle everything to deliver a magical reveal experience
          </p>
        </div>

        {/* Lightweight Progress Stepper */}
        <div className="flex items-center justify-between mb-8 bg-white/40 backdrop-blur-md border border-white/30 rounded-2xl p-4 shadow-sm text-[11px] sm:text-xs md:text-sm gap-2">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-1.5 md:gap-2">
              <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs ${
                step.isComplete 
                  ? "bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white" 
                  : "bg-gray-100 text-gray-400"
              }`}>
                {step.isComplete ? "✓" : idx + 1}
              </div>
              <span className={`font-semibold hidden sm:inline ${step.isComplete ? "text-gray-800" : "text-gray-400"}`}>
                {step.label}
              </span>
              <span className={`font-semibold sm:hidden ${step.isComplete ? "text-gray-800" : "text-gray-400"}`}>
                {step.label.split(" ")[0]}
              </span>
              {idx < steps.length - 1 && (
                <span className="text-gray-200 font-normal mx-1 md:mx-4">➔</span>
              )}
            </div>
          ))}
        </div>

        {/* Grid Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main Form Area */}
          <form className="lg:col-span-2 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm leading-relaxed" role="alert">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block mb-0.5">Please correct the following:</span>
                  {error}
                </div>
              </div>
            )}

            {/* Section 1: Reveal Type */}
            <div className="bg-white/40 backdrop-blur-md border border-white/30 rounded-2xl p-6 md:p-8 shadow-sm">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-[#f1f1f5] pb-3 mb-5 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#E8449A]" />
                1. What type of event?
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Gender Reveal Option */}
                <div
                  tabIndex={0}
                  role="radio"
                  aria-checked={mode === "reveal"}
                  className={`relative p-7 md:p-9 rounded-2xl border-2 cursor-pointer transition-all duration-300 flex flex-col gap-3 focus-visible:ring-2 focus-visible:ring-[#3A9FE8] focus-visible:outline-none ${
                    mode === "reveal"
                      ? "border-[#E8449A] bg-[#FDE8F2]/30 shadow-md shadow-[#e8449a0a] scale-[1.01]"
                      : "border-gray-100 hover:border-gray-200 bg-white"
                  }`}
                  onClick={() => !loading && setMode("reveal")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!loading) setMode("reveal");
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl select-none" aria-hidden="true">🎀</span>
                    <h3 className="font-black text-slate-900 text-base md:text-lg">Gender Reveal</h3>
                  </div>
                  <p className="text-xs md:text-sm text-gray-600 leading-relaxed font-semibold mt-1">
                    You don&apos;t know the gender yet. A private link is sent to a doctor or friend to enter it, and the system handles the rest.
                  </p>
                  {mode === "reveal" && (
                    <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-[#E8449A] flex items-center justify-center">
                      <span className="text-[10px] text-white font-bold select-none">✓</span>
                    </div>
                  )}
                </div>

                {/* Gender Announcement Option */}
                <div
                  tabIndex={0}
                  role="radio"
                  aria-checked={mode === "announcement"}
                  className={`relative p-7 md:p-9 rounded-2xl border-2 cursor-pointer transition-all duration-300 flex flex-col gap-3 focus-visible:ring-2 focus-visible:ring-[#3A9FE8] focus-visible:outline-none ${
                    mode === "announcement"
                      ? "border-[#3A9FE8] bg-[#D6EAFE]/30 shadow-md shadow-[#3a9fe80a] scale-[1.01]"
                      : "border-gray-100 hover:border-gray-200 bg-white"
                  }`}
                  onClick={() => !loading && setMode("announcement")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!loading) setMode("announcement");
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl select-none" aria-hidden="true">📣</span>
                    <h3 className="font-black text-slate-900 text-base md:text-lg">Gender Announcement</h3>
                  </div>
                  <p className="text-xs md:text-sm text-gray-600 leading-relaxed font-semibold mt-1">
                    You already know the gender. We create a cinematic announcement to share with family &amp; friends.
                  </p>
                  {mode === "announcement" && (
                    <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-[#3A9FE8] flex items-center justify-center">
                      <span className="text-[10px] text-white font-bold select-none">✓</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Family Details */}
            <div className="bg-white/40 backdrop-blur-md border border-white/30 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-[#f1f1f5] pb-3 mb-1 flex items-center gap-2">
                <User className="w-4 h-4 text-[#3A9FE8]" />
                2. Family details
              </h2>

              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="parentName" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Parent Name(s)</label>

                  </div>
                  <input
                    id="parentName"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] focus:border-[#3A9FE8] disabled:bg-gray-50 disabled:text-gray-400 transition-all font-medium"
                    type="text"
                    placeholder="e.g. Sarah &amp; Michael"
                    value={parentName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setParentName(val ? val.charAt(0).toUpperCase() + val.slice(1) : "");
                    }}
                    autoCapitalize="words"
                    disabled={loading}
                    maxLength={120}
                  />
                  <span className="text-xs text-gray-400 mt-0.5 font-medium">
                    Both parents&apos; names, or one — whatever feels right. Shown on the reveal.
                  </span>
                </div>

                {mode === "announcement" && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Baby&apos;s Gender</span>
                      <div className="grid grid-cols-2 gap-4">
                        <div
                          tabIndex={0}
                          role="radio"
                          aria-checked={announcementGender === "boy"}
                          className={`border-2 py-3 px-4 rounded-xl text-center font-bold text-sm cursor-pointer transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#3A9FE8] focus-visible:outline-none ${
                            announcementGender === "boy"
                              ? "border-[#3A9FE8] bg-[#D6EAFE]/30 text-[#1B4F8C]"
                              : "border-gray-100 hover:border-gray-200 text-gray-600 bg-white"
                          }`}
                          onClick={() => !loading && setAnnouncementGender("boy")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (!loading) setAnnouncementGender("boy");
                            }
                          }}
                        >
                          💙 Boy
                        </div>
                        <div
                          tabIndex={0}
                          role="radio"
                          aria-checked={announcementGender === "girl"}
                          className={`border-2 py-3 px-4 rounded-xl text-center font-bold text-sm cursor-pointer transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#E8449A] focus-visible:outline-none ${
                            announcementGender === "girl"
                              ? "border-[#E8449A] bg-[#FDE8F2]/30 text-[#C2527A]"
                              : "border-gray-100 hover:border-gray-200 text-gray-600 bg-white"
                          }`}
                          onClick={() => !loading && setAnnouncementGender("girl")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (!loading) setAnnouncementGender("girl");
                            }
                          }}
                        >
                          🩷 Girl
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 mt-0.5 font-medium">
                        This stays encrypted and is only shown during the reveal event.
                      </span>
                    </div>
                  </>
                )}


              </div>
            </div>



            {/* Section 4: Reveal Schedule */}
            {mode === "reveal" && (
              <div className="bg-white/40 backdrop-blur-md border border-white/30 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-[#f1f1f5] pb-3 mb-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#3A9FE8]" />
                  {isBasicPlan ? "3." : "4."} Reveal schedule
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5 relative">
                    <div className="flex items-center justify-between">
                      <label htmlFor="revealAt" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reveal Date &amp; Time</label>
                      {!!revealAt && (
                        <div className="flex gap-1 animate-bounce text-amber-400 text-xs">
                          <span>⭐</span>
                          <span>✨</span>
                          <span>⭐</span>
                        </div>
                      )}
                    </div>
                    <input
                      id="revealAt"
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] focus:border-[#3A9FE8] disabled:bg-gray-50 disabled:text-gray-400 transition-all font-medium cursor-pointer"
                      type="datetime-local"
                      value={revealAt}
                      onChange={(e) => setRevealAt(e.target.value)}
                      disabled={loading}
                      min={minDateTime}
                    />
                    <span className="text-xs text-gray-400 font-medium">Your selected timezone is shown below.</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Timezone</span>
                    <div className="relative" ref={tzDropdownRef}>
                      <button
                        type="button"
                        aria-expanded={tzDropdownOpen}
                        aria-haspopup="listbox"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 flex items-center justify-between hover:border-gray-300 transition-all focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] focus:border-[#3A9FE8] disabled:bg-gray-50 disabled:text-gray-400 font-medium"
                        onClick={() => !loading && setTzDropdownOpen((o) => !o)}
                        disabled={loading}
                      >
                        <span>{formatTimezone(timezone)}</span>
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      </button>

                      {tzDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[320px] animate-fade-in" role="listbox">
                          <input
                            type="text"
                            className="w-full px-4 py-3 border-b border-gray-100 text-sm focus:outline-none placeholder-gray-400 bg-gray-50/50 font-medium"
                            placeholder="Search all timezones…"
                            value={tzSearch}
                            onChange={(e) => setTzSearch(e.target.value)}
                            autoFocus
                          />

                          {!tzSearch && (
                            <div className="overflow-y-auto flex-1">
                              <div className="px-4 py-1.5 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">United States</div>
                              {US_TIMEZONES.map((tz) => (
                                <div
                                  key={tz.value}
                                  role="option"
                                  aria-selected={timezone === tz.value}
                                  className={`w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-[#3A9FE8]/5 hover:text-[#1B4F8C] transition-all flex items-center justify-between cursor-pointer ${
                                    timezone === tz.value ? "bg-[#D6EAFE]/30 text-[#1B4F8C] font-semibold" : "font-medium"
                                  }`}
                                  onClick={() => {
                                    setTimezone(tz.value);
                                    setTzDropdownOpen(false);
                                    setTzSearch("");
                                  }}
                                >
                                  <span>{tz.label} ({tz.short})</span>
                                  <span className="text-xs text-gray-400">{tz.value}</span>
                                </div>
                              ))}
                              <div className="px-4 py-1.5 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">All Other Timezones</div>
                            </div>
                          )}

                          <div className="overflow-y-auto flex-1">
                            {tzSearch && (
                              <>
                                {US_TIMEZONES.filter((tz) =>
                                  tz.label.toLowerCase().includes(tzSearch.toLowerCase()) ||
                                  tz.value.toLowerCase().includes(tzSearch.toLowerCase())
                                ).map((tz) => (
                                  <div
                                    key={tz.value}
                                    role="option"
                                    aria-selected={timezone === tz.value}
                                    className={`w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-[#3A9FE8]/5 hover:text-[#1B4F8C] transition-all flex items-center justify-between cursor-pointer ${
                                      timezone === tz.value ? "bg-[#D6EAFE]/30 text-[#1B4F8C] font-semibold" : "font-medium"
                                    }`}
                                    onClick={() => {
                                      setTimezone(tz.value);
                                      setTzDropdownOpen(false);
                                      setTzSearch("");
                                    }}
                                  >
                                    <span>{tz.label} ({tz.short})</span>
                                    <span className="text-xs text-gray-400">{tz.value}</span>
                                  </div>
                                ))}
                              </>
                            )}
                            {filteredWorldTimezones.length === 0 && tzSearch && (
                              <div className="px-4 py-6 text-center text-gray-400 text-sm font-medium">No timezones match &quot;{tzSearch}&quot;</div>
                            )}
                            {filteredWorldTimezones.map((tz) => (
                              <div
                                key={tz}
                                role="option"
                                aria-selected={timezone === tz}
                                className={`w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-[#3A9FE8]/5 hover:text-[#1B4F8C] transition-all flex items-center justify-between cursor-pointer ${
                                  timezone === tz ? "bg-[#D6EAFE]/30 text-[#1B4F8C] font-semibold" : "font-medium"
                                }`}
                                onClick={() => {
                                  setTimezone(tz);
                                  setTzDropdownOpen(false);
                                  setTzSearch("");
                                }}
                              >
                                <span>{formatTimezone(tz)}</span>
                                <span className="text-xs text-gray-400 font-normal">{tz}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 font-medium">All guest invites adjust automatically to their local time.</span>
                  </div>
                </div>
              </div>
            )}

            {/* Section 5: Revealer Details */}
            {mode === "reveal" && (() => {
              const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(revealerEmail.trim());
              return (
                <div className={`bg-white border rounded-2xl p-6 md:p-8 space-y-6 transition-all duration-500 ${
                  isEmailValid ? "shadow-2xl border-[#E8449A]/30 ring-4 ring-[#E8449A]/5" : "border-[#f1f1f5] shadow-sm"
                }`}>
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-[#f1f1f5] pb-3 mb-1 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#E8449A]" />
                    {isBasicPlan ? "4." : "5."} Revealer details
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="revealerName" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Revealer&apos;s Name</label>
                      <input
                        id="revealerName"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] focus:border-[#3A9FE8] disabled:bg-gray-50 disabled:text-gray-400 transition-all font-medium"
                        type="text"
                        placeholder="e.g. Dr. Davis"
                        value={revealerName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRevealerName(val ? val.charAt(0).toUpperCase() + val.slice(1) : "");
                        }}
                        autoCapitalize="words"
                        disabled={loading}
                      />
                      <span className="text-xs text-gray-400 font-medium">
                        Personalizes their invite and entry form.
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="revealerEmail" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Revealer&apos;s Email</label>
                      <input
                        id="revealerEmail"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] focus:border-[#3A9FE8] disabled:bg-gray-50 disabled:text-gray-400 transition-all font-medium"
                        type="email"
                        placeholder="doctor@clinic.com"
                        value={revealerEmail}
                        onChange={(e) => setRevealerEmail(e.target.value)}
                        disabled={loading}
                      />
                      <span className="text-xs text-gray-400 font-medium">
                        We&apos;ll send them a private, secure link to submit the gender.
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="revealerRelation" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Their Relation to You</label>
                      <div className="relative">
                        <select
                          id="revealerRelation"
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] focus:border-[#3A9FE8] disabled:bg-gray-50 disabled:text-gray-400 transition-all appearance-none cursor-pointer font-medium pr-10"
                          value={revealerRelation}
                          onChange={(e) => setRevealerRelation(e.target.value)}
                          disabled={loading}
                        >
                          {(Object.keys(RELATION_LABELS)).map((key) => (
                            <option key={key} value={key}>{RELATION_LABELS[key]}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Action Area */}
            <div className="pt-4 space-y-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white py-4 px-6 rounded-xl font-bold text-sm tracking-wider uppercase shadow-md shadow-[#e8449a1a] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {uploadProgress || "Setting up…"}
                  </>
                ) : (
                  "✦ Create My Reveal →"
                )}
              </button>
              <p className="text-xs text-gray-400 text-center font-medium">
                You&apos;ll be taken back to your dashboard once everything is set up.
              </p>
            </div>
          </form>

          {/* Sticky Summary Card Sidebar (Stacked on mobile, sticky on desktop) */}
          <div className="w-full lg:col-span-1">
            {summaryCardComponent}
          </div>
        </div>
        </div>
      </div>
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40 backdrop-blur-[4px]">
          <div className="bg-white/75 backdrop-blur-md border border-white/40 rounded-[24px] p-8 max-w-md w-full shadow-2xl relative text-center animate-scale-in">
            <div className="w-16 h-16 bg-gradient-to-tr from-[#E8449A]/20 to-[#3A9FE8]/20 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🎉</div>
            <h3 className="font-nunito font-extrabold text-xl bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] bg-clip-text text-transparent mb-2">Reveal Created Successfully!</h3>
            <p className="text-xs text-gray-500 font-semibold mb-6 leading-relaxed">
              Your virtual gender reveal is ready. Click below to download your custom reveal video.
            </p>
            {resolvingUrl ? (
              <div className="py-3 text-sm text-gray-500 font-bold animate-pulse">Generating secure download link...</div>
            ) : createdDownloadUrl ? (
              <a
                href={createdDownloadUrl}
                download="gender_reveal.mov"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 px-4 bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white rounded-xl text-sm font-bold tracking-wider uppercase shadow-md hover:opacity-95 active:scale-[0.98] transition-all mb-3 text-center"
              >
                Download Video (.MOV)
              </a>
            ) : (
              <div className="text-xs text-red-500 font-bold mb-3">Video file not found in storage.</div>
            )}
            <button
              onClick={() => {
                setShowSuccessModal(false);
                router.push("/dashboard");
              }}
              className="block w-full py-2.5 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
