"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { v4 as uuidv4 } from "uuid";
import { uploadPhotos, validatePhotoFiles } from "@/lib/storageService";
import {
  PHOTO_MAX,
  PHOTO_MIN,
  type EnquiryMode,
  type GenderValue,
  type RevealerRelation,
} from "@/lib/types";

// ─── Styles ─────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,300;0,400;1,300;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#F4F3F0;color:#111827;min-height:100vh;}
.page-wrap{max-width:720px;margin:0 auto;padding:5rem 2rem 4rem;}
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
.form-input:focus,.form-select:focus,.form-textarea:focus{border-color:#2E7DD1;box-shadow:0 0 0 3px rgba(46,125,209,0.1);}
.form-input::placeholder{color:#9CA3AF;}
.form-input:disabled{background:#F9FAFB;color:#9CA3AF;cursor:not-allowed;}

/* Mode selector */
.mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;}
@media(max-width:500px){.mode-grid{grid-template-columns:1fr;}}
.mode-opt{
  border:2px solid rgba(0,0,0,0.08);border-radius:8px;padding:1.2rem;
  cursor:pointer;text-align:left;transition:border-color 0.2s,background 0.2s;
  background:white;
}
.mode-opt:hover{border-color:#2E7DD1;}
.mode-opt.selected{border-color:#2E7DD1;background:rgba(46,125,209,0.04);}
.mode-title{font-size:0.9rem;font-weight:600;margin-bottom:0.3rem;color:#111827;}
.mode-desc{font-size:0.78rem;color:#6B7280;line-height:1.5;}

/* Gender radio (announcement mode) */
.gender-radio-grid{display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;}
.gender-opt{
  border:2px solid rgba(0,0,0,0.08);border-radius:8px;padding:0.9rem;
  cursor:pointer;text-align:center;transition:all 0.2s;background:white;
  font-size:0.88rem;font-weight:500;
}
.gender-opt:hover{border-color:#2E7DD1;}
.gender-opt.selected-boy{border-color:#2E7DD1;background:rgba(46,125,209,0.06);color:#1B4F8C;}
.gender-opt.selected-girl{border-color:#C2527A;background:rgba(194,82,122,0.06);color:#C2527A;}

/* Timezone dropdown */
.tz-wrapper{position:relative;}
.tz-trigger{
  width:100%;padding:0.85rem 1rem;border-radius:4px;
  border:1px solid rgba(0,0,0,0.12);background:white;
  font-family:'Plus Jakarta Sans',sans-serif;font-size:0.92rem;color:#111827;
  cursor:pointer;text-align:left;display:flex;justify-content:space-between;align-items:center;
  transition:border-color 0.2s;
}
.tz-trigger:hover:not(:disabled){border-color:#2E7DD1;}
.tz-trigger:disabled{background:#F9FAFB;color:#9CA3AF;cursor:not-allowed;}
.tz-chevron{font-size:0.7rem;color:#9CA3AF;margin-left:0.5rem;}
.tz-dropdown{
  position:absolute;top:calc(100% + 4px);left:0;right:0;
  background:white;border:1px solid rgba(0,0,0,0.1);border-radius:6px;
  box-shadow:0 8px 24px rgba(0,0,0,0.1);
  max-height:360px;overflow:hidden;z-index:100;
  display:flex;flex-direction:column;
}
.tz-search{
  width:100%;padding:0.7rem 0.9rem;border:none;border-bottom:1px solid rgba(0,0,0,0.08);
  font-family:'Plus Jakarta Sans',sans-serif;font-size:0.85rem;outline:none;
  background:#FAFAF9;
}
.tz-search:focus{background:white;}
.tz-group-label{
  padding:0.6rem 0.9rem 0.3rem;font-size:0.68rem;letter-spacing:0.15em;
  text-transform:uppercase;color:#9CA3AF;font-weight:500;
  background:#FAFAF9;border-bottom:1px solid rgba(0,0,0,0.04);
}
.tz-scroll{overflow-y:auto;flex:1;}
.tz-option{
  padding:0.65rem 0.9rem;cursor:pointer;font-size:0.85rem;color:#374151;
  display:flex;justify-content:space-between;align-items:center;
  border-bottom:1px solid rgba(0,0,0,0.04);
  transition:background 0.15s;
}
.tz-option:hover{background:rgba(46,125,209,0.05);color:#1B4F8C;}
.tz-option.selected{background:rgba(46,125,209,0.08);color:#1B4F8C;font-weight:500;}
.tz-value{font-size:0.7rem;color:#9CA3AF;margin-left:0.5rem;}
.tz-empty{padding:1rem;text-align:center;color:#9CA3AF;font-size:0.85rem;}

/* Photo picker */
.photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0.8rem;margin-bottom:0.6rem;}
@media(max-width:500px){.photo-grid{grid-template-columns:repeat(3,1fr);gap:0.5rem;}}
.photo-slot{
  aspect-ratio:1;border:2px dashed rgba(0,0,0,0.12);border-radius:8px;
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;position:relative;overflow:hidden;background:#FAFAF9;
  transition:border-color 0.2s;
}
.photo-slot:hover{border-color:#2E7DD1;}
.photo-slot.filled{border-style:solid;border-color:rgba(0,0,0,0.08);}
.photo-slot.filled:hover{border-color:rgba(0,0,0,0.08);}
.photo-preview{width:100%;height:100%;object-fit:cover;}
.photo-placeholder{font-size:0.7rem;color:#9CA3AF;letter-spacing:0.1em;text-transform:uppercase;text-align:center;padding:0.5rem;}
.photo-remove{
  position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;
  background:rgba(17,24,39,0.75);color:white;border:none;cursor:pointer;
  font-size:12px;display:flex;align-items:center;justify-content:center;
  transition:background 0.2s;
}
.photo-remove:hover{background:rgba(17,24,39,0.95);}
.photo-hint{font-size:0.75rem;color:#9CA3AF;margin-top:0.3rem;line-height:1.5;}

.form-divider{height:1px;background:rgba(0,0,0,0.06);margin:1.8rem 0;}
.btn-submit{
  width:100%;padding:1.05rem;border:none;border-radius:4px;cursor:pointer;
  background:linear-gradient(135deg,#2E7DD1,#C2527A);color:white;
  font-family:'Plus Jakarta Sans',sans-serif;font-size:0.84rem;font-weight:500;
  letter-spacing:0.1em;text-transform:uppercase;
  box-shadow:0 4px 16px rgba(46,125,209,0.25);
  transition:transform 0.2s,box-shadow 0.2s,opacity 0.2s;
}
.btn-submit:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 28px rgba(46,125,209,0.32);}
.btn-submit:disabled{opacity:0.6;cursor:not-allowed;transform:none;}
.error-msg{font-size:0.8rem;color:#DC2626;padding:0.7rem 0.9rem;background:#FEF2F2;border-radius:4px;border:1px solid rgba(220,38,38,0.15);margin-bottom:1rem;line-height:1.5;}
.hint{font-size:0.75rem;color:#9CA3AF;margin-top:0.3rem;line-height:1.5;}
.progress-note{font-size:0.75rem;color:#2E7DD1;margin-top:0.6rem;text-align:center;}
@keyframes spin{to{transform:rotate(360deg);}}
.spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:8px;}
`;

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
    // Intl.supportedValuesOf is available in modern browsers (2022+)
    const supported = (Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    }).supportedValuesOf;
    if (typeof supported === "function") {
      return supported("timeZone").sort();
    }
  } catch {
    // fall through
  }
  // Fallback: just US timezones
  return US_TIMEZONES.map((t) => t.value);
}

// Format a timezone for display in the dropdown
function formatTimezone(tz: string): string {
  const us = US_TIMEZONES.find((t) => t.value === tz);
  if (us) return `${us.label} (${us.short})`;
  // For non-US zones, show a friendlier label: "Asia/Kolkata" → "Kolkata (Asia)"
  const parts = tz.split("/");
  if (parts.length >= 2) {
    const city = parts[parts.length - 1].replace(/_/g, " ");
    const region = parts[0];
    return `${city} (${region})`;
  }
  return tz;
}

function getMinDateTime(): string {
  // Min = now + 1 hour, formatted for <input type="datetime-local">
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

// ─── Component ──────────────────────────────────────────────

export default function NewRevealPage() {
  const { user, firestoreUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [error, setError] = useState("");

  // Entitlement guard: redirect if user can't create a reveal
  //   - Not logged in → /login
  //   - No revealsAllowed → /dashboard (with hint via URL param)
  useEffect(() => {
    if (authLoading) return; // wait for auth to resolve
    if (!user) {
      router.replace("/login?redirect=/new-reveal");
      return;
    }
    if (firestoreUser && (firestoreUser.revealsAllowed ?? 0) <= 0) {
      router.replace("/dashboard?noEntitlement=1");
    }
  }, [authLoading, user, firestoreUser, router]);

  // Shared fields
  const [mode, setMode] = useState<EnquiryMode>("reveal");
  const [parentName, setParentName] = useState("");
  const [revealAt, setRevealAt] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  // Announcement mode fields
  const [babyName, setBabyName] = useState("");
  const [announcementGender, setAnnouncementGender] = useState<GenderValue | null>(null);

  // Reveal mode fields
  const [babyNameGirl, setBabyNameGirl] = useState("");
  const [babyNameBoy, setBabyNameBoy] = useState("");
  const [revealerEmail, setRevealerEmail] = useState("");
  const [revealerRelation, setRevealerRelation] = useState<RevealerRelation>("doctor");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [timezone, setTimezone] = useState<string>(() => getInitialTimezone());
  const [tzSearch, setTzSearch] = useState("");
  const [tzDropdownOpen, setTzDropdownOpen] = useState(false);
  const tzDropdownRef = useRef<HTMLDivElement>(null);
  const minDateTime = useMemo(() => getMinDateTime(), []);

  // All timezones for the search list (memoized — expensive call)
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

  // Preview URLs for selected photos
  const previewUrls = useMemo(
    () => photoFiles.map((f) => URL.createObjectURL(f)),
    [photoFiles]
  );

  // ─── Photo handlers ──────────────────────────────────────

  function handlePhotoSlotClick() {
    if (photoFiles.length >= PHOTO_MAX) return;
    fileInputRef.current?.click();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Combine with existing, cap at PHOTO_MAX
    const combined = [...photoFiles, ...files].slice(0, PHOTO_MAX);
    const validation = validatePhotoFiles(combined);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setError("");
    setPhotoFiles(combined);
    // Reset the input so user can re-select the same file if they remove it
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setError("");
  }

  // ─── Validation ──────────────────────────────────────────

  function validateForm(): string | null {
    if (!parentName.trim()) return "Please enter the parent name(s).";
    if (!revealAt) return "Please pick a reveal date and time.";

    const revealDate = new Date(revealAt);
    if (isNaN(revealDate.getTime())) return "Invalid reveal date.";
    if (revealDate.getTime() < Date.now() + 30 * 60 * 1000) {
      return "Reveal time must be at least 30 minutes in the future.";
    }

    const photoValidation = validatePhotoFiles(photoFiles);
    if (!photoValidation.ok) return photoValidation.error;

    if (mode === "announcement") {
      if (!announcementGender) return "Please select the baby's gender.";
    } else {
      // reveal mode
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
      // 1. Upload photos to Storage first (client-side, direct to Firebase Storage)
      setUploadProgress(`Uploading ${photoFiles.length} photo${photoFiles.length > 1 ? "s" : ""}…`);
      const photoUrls = await uploadPhotos(enquiryId, photoFiles);

      // 2. Call server-side API to atomically:
      //    - Verify entitlement
      //    - Create the enquiry doc
      //    - Consume one purchase slot
      //    - (announcement mode) encrypt + save the gender to secure-genders
      //
      //    If this API call fails, the server-side handler will delete the
      //    photos we just uploaded to prevent orphaned Storage files.
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
          photos: photoUrls,
          revealAtMs: new Date(revealAt).getTime(),
          revealTimezone: timezone,
          // Announcement mode
          babyName: mode === "announcement" ? (babyName.trim() || null) : null,
          announcementGender: mode === "announcement" ? announcementGender : undefined,
          // Reveal mode
          babyNameGirl: mode === "reveal" ? (babyNameGirl.trim() || null) : null,
          babyNameBoy: mode === "reveal" ? (babyNameBoy.trim() || null) : null,
          revealerEmail: mode === "reveal" ? revealerEmail.trim().toLowerCase() : undefined,
          revealerRelation: mode === "reveal" ? revealerRelation : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to create reveal. Please try again.");
      }

      // 3. Redirect to dashboard with success flag
      setUploadProgress("Finishing up…");
      router.push(`/dashboard?created=${enquiryId}`);
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

  return (
    <>
      <style>{CSS}</style>
      <div className="page-wrap">
        <a href="/dashboard" className="back-link">← Back to Dashboard</a>
        <div className="page-header">
          <h1 className="page-title">Create Your Reveal</h1>
          <p className="page-sub">
            Tell us about your little one and we&apos;ll take care of the rest — secure
            revealer link, personalized video, and live broadcast to your loved ones.
          </p>
        </div>

        <form className="form-card" onSubmit={handleSubmit}>
          {error && <div className="error-msg">⚠ {error}</div>}

          {/* ── Mode Selection ── */}
          <div className="form-section-title">What type of event?</div>
          <div className="mode-grid">
            <div
              className={`mode-opt${mode === "reveal" ? " selected" : ""}`}
              onClick={() => !loading && setMode("reveal")}
            >
              <div className="mode-title">🎀 Gender Reveal</div>
              <div className="mode-desc">
                You don&apos;t know the gender yet. A revealer (doctor, relative, etc.)
                submits it privately, and it plays at the reveal.
              </div>
            </div>
            <div
              className={`mode-opt${mode === "announcement" ? " selected" : ""}`}
              onClick={() => !loading && setMode("announcement")}
            >
              <div className="mode-title">📣 Gender Announcement</div>
              <div className="mode-desc">
                You already know the gender. We create a cinematic announcement to
                share with family &amp; friends.
              </div>
            </div>
          </div>

          <div className="form-divider" />

          {/* ── About You & Baby ── */}
          <div className="form-section-title">About You &amp; Baby</div>

          <div className="form-group">
            <label className="form-label">Parent Name(s)</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Sarah &amp; Michael"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              disabled={loading}
              maxLength={120}
            />
            <div className="hint">
              Both parents&apos; names, or one — whatever feels right. Shown on the reveal.
            </div>
          </div>

          {mode === "announcement" && (
            <>
              <div className="form-group">
                <label className="form-label">Baby&apos;s Name (optional)</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Sophia"
                  value={babyName}
                  onChange={(e) => setBabyName(e.target.value)}
                  disabled={loading}
                  maxLength={80}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Baby&apos;s Gender</label>
                <div className="gender-radio-grid">
                  <div
                    className={`gender-opt${announcementGender === "boy" ? " selected-boy" : ""}`}
                    onClick={() => !loading && setAnnouncementGender("boy")}
                  >
                    💙 Boy
                  </div>
                  <div
                    className={`gender-opt${announcementGender === "girl" ? " selected-girl" : ""}`}
                    onClick={() => !loading && setAnnouncementGender("girl")}
                  >
                    🩷 Girl
                  </div>
                </div>
                <div className="hint">
                  This stays encrypted and is only shown during the reveal event.
                </div>
              </div>
            </>
          )}

          {mode === "reveal" && (
            <div className="form-grid">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">If it&apos;s a girl (optional)</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Sophia"
                  value={babyNameGirl}
                  onChange={(e) => setBabyNameGirl(e.target.value)}
                  disabled={loading}
                  maxLength={80}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">If it&apos;s a boy (optional)</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Michael"
                  value={babyNameBoy}
                  onChange={(e) => setBabyNameBoy(e.target.value)}
                  disabled={loading}
                  maxLength={80}
                />
              </div>
            </div>
          )}

          <div className="form-divider" />

          {/* ── Photos ── */}
          <div className="form-section-title">Photos (1 to {PHOTO_MAX})</div>

          <div className="photo-grid">
            {Array.from({ length: PHOTO_MAX }).map((_, i) => {
              const file = photoFiles[i];
              const url = previewUrls[i];
              if (file && url) {
                return (
                  <div key={i} className="photo-slot filled">
                    <img className="photo-preview" src={url} alt={`Photo ${i + 1}`} />
                    {!loading && (
                      <button
                        type="button"
                        className="photo-remove"
                        onClick={() => removePhoto(i)}
                        aria-label={`Remove photo ${i + 1}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              }
              // Empty slot — only the first empty slot is clickable
              const isNextSlot = i === photoFiles.length;
              return (
                <div
                  key={i}
                  className="photo-slot"
                  onClick={isNextSlot && !loading ? handlePhotoSlotClick : undefined}
                  style={{ cursor: isNextSlot && !loading ? "pointer" : "default", opacity: isNextSlot ? 1 : 0.4 }}
                >
                  <span className="photo-placeholder">
                    {isNextSlot ? "+ Add Photo" : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif"
            multiple
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />

          <div className="photo-hint">
            {photoFiles.length} of {PHOTO_MAX} photos selected. Max 5 MB each.
            We recommend including a sonogram if you have one.
          </div>

          <div className="form-divider" />

         {/* ── Reveal Date & Time ── */}
         <div className="form-section-title">When should the reveal play?</div>
          <div className="form-group">
            <label className="form-label">Reveal Date &amp; Time</label>
            <input
              className="form-input"
              type="datetime-local"
              value={revealAt}
              onChange={(e) => setRevealAt(e.target.value)}
              disabled={loading}
              min={minDateTime}
            />
            <div className="hint">Your selected timezone is shown below.</div>
          </div>

          <div className="form-group">
            <label className="form-label">Timezone</label>
            <div className="tz-wrapper" ref={tzDropdownRef}>
              <button
                type="button"
                className="tz-trigger"
                onClick={() => !loading && setTzDropdownOpen((o) => !o)}
                disabled={loading}
              >
                <span>{formatTimezone(timezone)}</span>
                <span className="tz-chevron">{tzDropdownOpen ? "▲" : "▼"}</span>
              </button>

              {tzDropdownOpen && (
                <div className="tz-dropdown">
                  <input
                    type="text"
                    className="tz-search"
                    placeholder="Search all timezones…"
                    value={tzSearch}
                    onChange={(e) => setTzSearch(e.target.value)}
                    autoFocus
                  />

                  {!tzSearch && (
                    <>
                      <div className="tz-group-label">United States</div>
                      {US_TIMEZONES.map((tz) => (
                        <div
                          key={tz.value}
                          className={`tz-option${timezone === tz.value ? " selected" : ""}`}
                          onClick={() => {
                            setTimezone(tz.value);
                            setTzDropdownOpen(false);
                            setTzSearch("");
                          }}
                        >
                          <span>{tz.label} ({tz.short})</span>
                          <span className="tz-value">{tz.value}</span>
                        </div>
                      ))}
                      <div className="tz-group-label">All Other Timezones</div>
                    </>
                  )}

                  <div className="tz-scroll">
                    {tzSearch && (
                      <>
                        {/* Show matching US zones when searching */}
                        {US_TIMEZONES.filter((tz) =>
                          tz.label.toLowerCase().includes(tzSearch.toLowerCase()) ||
                          tz.value.toLowerCase().includes(tzSearch.toLowerCase())
                        ).map((tz) => (
                          <div
                            key={tz.value}
                            className={`tz-option${timezone === tz.value ? " selected" : ""}`}
                            onClick={() => {
                              setTimezone(tz.value);
                              setTzDropdownOpen(false);
                              setTzSearch("");
                            }}
                          >
                            <span>{tz.label} ({tz.short})</span>
                            <span className="tz-value">{tz.value}</span>
                          </div>
                        ))}
                      </>
                    )}
                    {filteredWorldTimezones.length === 0 && tzSearch && (
                      <div className="tz-empty">No timezones match &quot;{tzSearch}&quot;</div>
                    )}
                    {filteredWorldTimezones.map((tz) => (
                      <div
                        key={tz}
                        className={`tz-option${timezone === tz ? " selected" : ""}`}
                        onClick={() => {
                          setTimezone(tz);
                          setTzDropdownOpen(false);
                          setTzSearch("");
                        }}
                      >
                        <span>{formatTimezone(tz)}</span>
                        <span className="tz-value">{tz}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="hint">
              All guest invites adjust automatically to their local time.
            </div>
          </div>

          {/* ── Revealer (reveal mode only) ── */}
          {mode === "reveal" && (
            <>
              <div className="form-divider" />
              <div className="form-section-title">Your Revealer</div>
              <div className="form-group">
                <label className="form-label">Revealer&apos;s Email</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="doctor@clinic.com"
                  value={revealerEmail}
                  onChange={(e) => setRevealerEmail(e.target.value)}
                  disabled={loading}
                />
                <div className="hint">
                  We&apos;ll send them a private, one-time secure link. They submit the
                  gender — you won&apos;t know until the reveal plays.
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Their Relation to You</label>
                <select
                  className="form-select"
                  value={revealerRelation}
                  onChange={(e) => setRevealerRelation(e.target.value as RevealerRelation)}
                  disabled={loading}
                >
                  {(Object.keys(RELATION_LABELS) as RevealerRelation[]).map((key) => (
                    <option key={key} value={key}>{RELATION_LABELS[key]}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="form-divider" />

          <button className="btn-submit" type="submit" disabled={loading}>
            {loading ? (
              <><span className="spinner" />{uploadProgress || "Setting up…"}</>
            ) : (
              "✦ Create My Reveal →"
            )}
          </button>
          <div className="hint" style={{ textAlign: "center", marginTop: "0.8rem" }}>
            You&apos;ll be taken back to your dashboard once everything is set up.
          </div>
        </form>
      </div>
    </>
  );
}
