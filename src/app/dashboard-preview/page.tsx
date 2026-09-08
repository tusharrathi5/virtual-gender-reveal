"use client";

import { useState } from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getPaymentStatusLabel } from "@/lib/statusLabels";
import { User } from "lucide-react";

// ─── This is a static, read-only clone of /dashboard (src/app/dashboard/page.tsx) ───
// It renders with hardcoded sample data instead of live Firebase/API calls so that
// reviewers (e.g. Twilio Toll-Free Verification) can see the real UI, including the
// SMS opt-in flow, without needing to sign in. No data here is real, and no button
// on this page sends a network request, SMS, or email.

type RevealerRelation = "doctor" | "relative" | "friend" | "other";

const RELATION_LABELS: Record<RevealerRelation, string> = {
  doctor: "Doctor / Midwife",
  relative: "Relative",
  friend: "Friend",
  other: "Other",
};

interface EditableGuestRow {
  rowId: string;
  name: string;
  phone: string;
  email: string;
}

interface SampleGuestRow {
  guestId: string;
  name: string;
  phone: string;
  email: string;
  prediction: "boy" | "girl" | null;
  message: string | null;
  isHost?: boolean;
}

interface SampleEditForm {
  parentName: string;
  revealAt: string;
  revealTimezone: string;
  revealerName: string;
  revealerEmail: string;
  revealerRelation: RevealerRelation;
}

function blankGuestRow(rowId: string): EditableGuestRow {
  return { rowId, name: "", phone: "", email: "" };
}

function makeGuestRow(): EditableGuestRow {
  return blankGuestRow(`draft-${Date.now()}-${Math.round(Math.random() * 10000)}`);
}

function IconImg({ src, alt = "", className }: { src: string; alt?: string; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      className="fixed top-20 right-6 z-[9999] border-l-4 border-blue-500 bg-blue-50 text-blue-800 rounded-xl p-4 shadow-lg flex items-center justify-between gap-4 max-w-sm md:max-w-md font-medium text-sm"
      role="alert"
    >
      <div className="flex items-center gap-2">
        <span className="font-bold text-xs uppercase bg-white/70 px-2 py-0.5 rounded-full shrink-0">i</span>
        <span>{message}</span>
      </div>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-800 font-bold text-lg leading-none shrink-0"
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}

const SAMPLE_REVEAL_AT = "Tue, Sep 1, 10:00 AM";
const SAMPLE_CREATED_LABEL = "10 hours left to edit";

export default function DashboardPreviewPage() {
  const [toast, setToast] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<SampleEditForm>({
    parentName: "Adam & Cam",
    revealAt: "2026-09-01T10:00",
    revealTimezone: "America/Los_Angeles",
    revealerName: "Dr. Koral",
    revealerEmail: "ask1209@aol.com",
    revealerRelation: "doctor",
  });
  const [registryDraft, setRegistryDraft] = useState("");
  const [guestDraftRows, setGuestDraftRows] = useState<EditableGuestRow[]>([
    blankGuestRow("draft-1"),
    blankGuestRow("draft-2"),
    blankGuestRow("draft-3"),
    blankGuestRow("draft-4"),
  ]);
  const [smsConsent, setSmsConsent] = useState(false);

  const guestRows: SampleGuestRow[] = [
    {
      guestId: "sample-host",
      name: "Alex (You)",
      phone: "(555) 010-0000",
      email: "alex@example.com",
      prediction: null,
      message: null,
      isHost: true,
    },
    {
      guestId: "sample-1",
      name: "Jamie Smith",
      phone: "(555) 123-4567",
      email: "jamie@example.com",
      prediction: "girl",
      message: "Can't wait to see!! 💗",
    },
    {
      guestId: "sample-2",
      name: "Taylor Reyes",
      phone: "(555) 987-6543",
      email: "taylor@example.com",
      prediction: "boy",
      message: null,
    },
  ];

  function updateGuestDraft(rowId: string, field: keyof Omit<EditableGuestRow, "rowId">, value: string) {
    setGuestDraftRows((rows) => rows.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row)));
  }

  function removeGuestDraft(rowId: string) {
    setGuestDraftRows((rows) => {
      const next = rows.filter((row) => row.rowId !== rowId);
      return next.length ? next : [blankGuestRow(`draft-${Date.now()}`)];
    });
  }

  function showPreviewToast() {
    setToast("This is a sample preview — no real messages, emails, or changes are sent from this page.");
  }

  return (
    <DashboardShell activeTab="dashboard" title="Dashboard" showVideoBackground={true}>
      <div className="w-full space-y-8 font-jakarta">
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}

        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <IconImg src="/images/icon-storkwbag.png" className="hidden sm:block w-20 h-20 object-contain shrink-0" />
            <div>
              <span className="text-xs font-bold text-[#E8449A] uppercase tracking-widest block mb-1">Your Dashboard</span>
              <h1 className="font-nunito font-extrabold text-3xl md:text-4xl tracking-tight bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] bg-clip-text text-transparent">
                Hello, Alex
              </h1>
              <p className="text-sm text-gray-500 font-semibold mt-1">
                Manage details, photos, guest invitations and view live broadcasts.
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-tr from-[#FDE8F2] to-[#D6EAFE] border border-white rounded-2xl px-5 py-4 shadow-sm flex items-center gap-3">
            <IconImg src="/images/icon-gift.png" className="w-10 h-10 object-contain shrink-0" />
            <div className="text-xs text-gray-700 font-semibold">
              <span className="text-gray-400 block uppercase font-bold text-[9px] tracking-wider mb-0.5">Active Account</span>
              <span className="text-gray-900 font-bold">Little Bundle</span>
            </div>
          </div>
        </div>

        {/* Your Reveals */}
        <section className="space-y-6">
          <div className="bg-white/40 backdrop-blur-md border border-white/30 shadow-lg rounded-2xl p-4 shadow-sm mb-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <IconImg src="/images/icon-heart.png" className="w-5 h-5 object-contain" />
              Your Reveals
            </h2>
          </div>

          <div className="space-y-6">
            <article className="bg-white/40 backdrop-blur-md border border-white/30 shadow-lg rounded-[20px] p-6 md:p-8 shadow-sm space-y-6">
              {/* Reveal Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-50 pb-4">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[10px] bg-[#D6EAFE] text-[#1B4F8C] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      Surprise Reveal
                    </span>
                    <h3 className="font-nunito font-extrabold text-lg text-gray-900 mt-1">{editForm.parentName}</h3>
                    <span className="text-xs text-gray-500 font-semibold flex items-center gap-1 mt-0.5">
                      <IconImg src="/images/icon-calendar.png" className="w-4 h-4 object-contain" />
                      {SAMPLE_REVEAL_AT}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800">
                    Video Ready
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 bg-green-100 text-green-800">
                    <IconImg src="/images/icon-greenclock.png" className="w-3.5 h-3.5 object-contain shrink-0" />
                    {SAMPLE_CREATED_LABEL}
                  </span>

                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="border border-gray-200 text-[#374151] hover:bg-gray-50 font-bold text-xs uppercase tracking-wider rounded-lg px-3.5 py-2 flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                    >
                      Edit
                    </button>
                  )}

                  <button
                    onClick={showPreviewToast}
                    className="bg-[#3A9FE8] text-white hover:bg-[#2E7DD1] active:scale-[0.98] transition-all font-bold text-xs uppercase tracking-wider rounded-lg px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                  >
                    Join Party
                  </button>
                </div>
              </div>

              {/* View Details Grid */}
              {!isEditing && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="bg-pink-50/60 rounded-xl p-3 border border-pink-100 flex flex-col items-center text-center gap-1.5">
                    <IconImg src="/images/icon-wand.png" className="w-14 h-14 object-contain" />
                    <div className="min-w-0">
                      <span className="text-[9px] text-gray-400 block uppercase font-bold tracking-wider mb-0.5">Reveal Mode</span>
                      <span className="text-xs font-semibold text-gray-800 block break-words">Surprise Reveal</span>
                    </div>
                  </div>
                  <div className="bg-pink-50/60 rounded-xl p-3 border border-pink-100 flex flex-col items-center text-center gap-1.5">
                    <IconImg src="/images/icon-pinkclock.png" className="w-14 h-14 object-contain" />
                    <div className="min-w-0">
                      <span className="text-[9px] text-gray-400 block uppercase font-bold tracking-wider mb-0.5">Reveal Time</span>
                      <span className="text-xs font-semibold text-gray-800 block break-words">{SAMPLE_REVEAL_AT}</span>
                    </div>
                  </div>
                  <div className="bg-blue-50/60 rounded-xl p-3 border border-blue-100 flex flex-col items-center text-center gap-1.5">
                    <IconImg src="/images/globe.png" className="w-14 h-14 object-contain" />
                    <div className="min-w-0">
                      <span className="text-[9px] text-gray-400 block uppercase font-bold tracking-wider mb-0.5">Selected Timezone</span>
                      <span className="text-xs font-semibold text-gray-800 block break-words">{editForm.revealTimezone}</span>
                    </div>
                  </div>
                  <div className="bg-blue-50/60 rounded-xl p-3 border border-blue-100 flex flex-col items-center text-center gap-1.5">
                    <IconImg src="/images/icon-payment.png" className="w-14 h-14 object-contain" />
                    <div className="min-w-0">
                      <span className="text-[9px] text-gray-400 block uppercase font-bold tracking-wider mb-0.5">Payment Status</span>
                      <span className="text-xs font-bold text-gray-800 block break-words">{getPaymentStatusLabel("completed")}</span>
                    </div>
                  </div>
                  <div className="bg-blue-50/60 rounded-xl p-3 border border-blue-100 flex flex-col items-center text-center gap-1.5">
                    <IconImg src="/images/icon-doctor.png" className="w-14 h-14 object-contain" />
                    <div className="min-w-0">
                      <span className="text-[9px] text-gray-400 block uppercase font-bold tracking-wider mb-0.5">Revealer Name</span>
                      <span className="text-xs font-semibold text-gray-800 block break-words">{editForm.revealerName}</span>
                    </div>
                  </div>
                  <div className="bg-pink-50/60 rounded-xl p-3 border border-pink-100 flex flex-col items-center text-center gap-1.5">
                    <IconImg src="/images/icon-mail.png" className="w-14 h-14 object-contain" />
                    <div className="min-w-0">
                      <span className="text-[9px] text-gray-400 block uppercase font-bold tracking-wider mb-0.5">Revealer Email</span>
                      <span className="text-xs font-semibold text-gray-800 block break-words">{editForm.revealerEmail}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Gift Registry */}
              {!isEditing && (
                <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100 space-y-2">
                  <span className="text-[9px] text-gray-400 block uppercase font-bold tracking-wider">
                    Gift Registry Link (shown on your party page)
                  </span>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="www.yourregistry.com/..."
                      value={registryDraft}
                      onChange={(e) => setRegistryDraft(e.target.value)}
                      className="flex-1 text-xs font-semibold text-gray-800 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                    />
                    <button
                      type="button"
                      onClick={showPreviewToast}
                      className="bg-[#3A9FE8] text-white hover:bg-[#2E7DD1] active:scale-[0.98] transition-all font-bold text-xs uppercase tracking-wider rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* Edit Form */}
              {isEditing && (
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 md:p-6 space-y-6">
                  <div className="flex gap-3 pb-2 border-b border-gray-200/50">
                    <button
                      type="button"
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border bg-white border-[#E8449A] text-[#C2527A] shadow-sm"
                    >
                      Surprise Reveal
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border bg-transparent border-gray-200 text-gray-500"
                    >
                      We Already Know!
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Parent Name(s)</label>
                      <input
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                        value={editForm.parentName}
                        onChange={(e) => setEditForm((f) => ({ ...f, parentName: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reveal Date &amp; Time</label>
                      <input
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                        type="datetime-local"
                        value={editForm.revealAt}
                        onChange={(e) => setEditForm((f) => ({ ...f, revealAt: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Timezone</label>
                      <input
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                        value={editForm.revealTimezone}
                        onChange={(e) => setEditForm((f) => ({ ...f, revealTimezone: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Revealer Name</label>
                      <input
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                        value={editForm.revealerName}
                        onChange={(e) => setEditForm((f) => ({ ...f, revealerName: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Revealer Email</label>
                      <input
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                        type="email"
                        value={editForm.revealerEmail}
                        onChange={(e) => setEditForm((f) => ({ ...f, revealerEmail: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Relation</label>
                      <select
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                        value={editForm.revealerRelation}
                        onChange={(e) => setEditForm((f) => ({ ...f, revealerRelation: e.target.value as RevealerRelation }))}
                      >
                        {(Object.keys(RELATION_LABELS) as RevealerRelation[]).map((key) => (
                          <option key={key} value={key}>
                            {RELATION_LABELS[key]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        showPreviewToast();
                      }}
                      className="bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white hover:opacity-90 active:scale-[0.98] transition-all font-bold text-xs uppercase tracking-wider rounded-xl py-3 px-5 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                    >
                      Save Changes
                    </button>
                    <button
                      className="border border-gray-200 text-[#374151] hover:bg-gray-100 font-bold text-xs uppercase tracking-wider rounded-xl py-3 px-5 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </article>
          </div>
        </section>

        {/* Guest Invites Portal */}
        <section className="space-y-6">
          <div className="bg-white/40 backdrop-blur-md border border-white/30 shadow-lg rounded-2xl p-4 shadow-sm mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-3">
              <IconImg src="/images/icon-mailwithheart.png" className="w-14 h-14 object-contain shrink-0" />
              <div>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Invite Guests</h2>
                <p className="text-xs text-gray-600 font-semibold mt-1">
                  Invite your guests by adding their phone number, email or both! We&rsquo;ll send them a secure invite link.
                </p>
              </div>
            </div>
            <IconImg src="/images/icon-teddy.png" className="hidden sm:block w-28 h-28 object-contain shrink-0" />
          </div>

          <div className="bg-white/40 backdrop-blur-md border border-white/30 shadow-lg rounded-[20px] p-6 md:p-8 shadow-sm space-y-6">
            {/* Input Table */}
            <div className="overflow-x-auto border border-white/20 rounded-xl">
              <table className="w-full text-left border-collapse text-xs md:text-sm">
                <thead>
                  <tr className="bg-white/10 border-b border-white/20 font-bold text-gray-500 uppercase text-[10px] tracking-wider">
                    <th className="p-4">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#3A9FE8]" />
                        Name
                      </span>
                    </th>
                    <th className="p-4">
                      <span className="inline-flex items-center gap-1.5">
                        <IconImg src="/images/icon-phone.png" className="w-5 h-5 object-contain" />
                        Phone Number
                      </span>
                    </th>
                    <th className="p-4">
                      <span className="inline-flex items-center gap-1.5">
                        <IconImg src="/images/icon-mail.png" className="w-5 h-5 object-contain" />
                        Email
                      </span>
                    </th>
                    <th className="p-4 text-right">
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        <IconImg src="/images/icon-yellowstar.png" className="w-5 h-5 object-contain" />
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-white/20 backdrop-blur-sm">
                  {guestDraftRows.map((row, rowIndex) => (
                    <tr key={row.rowId}>
                      <td className="p-3">
                        <div className="relative">
                          <IconImg
                            src={rowIndex % 2 === 0 ? "/images/icon-bluestar.png" : "/images/icon-pinkstar.png"}
                            className="w-5 h-5 object-contain absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                          />
                          <input
                            className="bg-white/20 border border-white/20 text-gray-800 placeholder-gray-500/80 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] w-full font-medium transition-all"
                            value={row.name}
                            onChange={(e) => updateGuestDraft(row.rowId, "name", e.target.value)}
                            placeholder="Guest name"
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="relative">
                          <IconImg
                            src="/images/icon-phone.png"
                            className="w-5 h-5 object-contain absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                          />
                          <input
                            className="bg-white/20 border border-white/20 text-gray-800 placeholder-gray-500/80 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] w-full font-medium transition-all"
                            value={row.phone}
                            onChange={(e) => updateGuestDraft(row.rowId, "phone", e.target.value)}
                            placeholder="Phone number"
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="relative">
                          <IconImg
                            src="/images/icon-mail.png"
                            className="w-5 h-5 object-contain absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                          />
                          <input
                            className="bg-white/20 border border-white/20 text-gray-800 placeholder-gray-500/80 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] w-full font-medium transition-all"
                            type="email"
                            value={row.email}
                            onChange={(e) => updateGuestDraft(row.rowId, "email", e.target.value)}
                            placeholder="guest@example.com"
                          />
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeGuestDraft(row.rowId)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500"
                          aria-label="Remove guest"
                        >
                          <IconImg src="/images/icon-trash.png" className="w-6 h-6 object-contain" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SMS Consent */}
            <div className="pt-6 border-t border-gray-100 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer select-none bg-gray-50/60 border border-gray-100 rounded-xl p-4">
                <IconImg src="/images/icon-shieldWithHeart.png" className="w-14 h-14 object-contain shrink-0" />
                <span className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={smsConsent}
                    onChange={(e) => setSmsConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 shrink-0 rounded border-gray-300 text-[#E8449A] focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] cursor-pointer"
                  />
                  <span className="text-[11px] text-gray-500 font-medium leading-normal">
                    <strong className="text-gray-700 block mb-1">
                      I confirm I have this recipient&apos;s consent to receive SMS from VG Reveal Corp.
                    </strong>
                    By checking this box, you confirm the recipient agreed to receive text messages about this Virtual
                    Gender Reveal event — including their invitation, event reminders, and event updates. Message
                    frequency varies by event. Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help.
                  </span>
                </span>
              </label>
              <p className="text-[11px] text-gray-400 font-medium pl-4">
                See our{" "}
                <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#3A9FE8] font-bold hover:underline">
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#3A9FE8] font-bold hover:underline">
                  Terms of Service
                </a>
                .
              </p>
            </div>

            {/* Bottom Action Bar */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex flex-col gap-2 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => setGuestDraftRows((rows) => [...rows, makeGuestRow()])}
                  className="w-full md:w-auto bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white hover:opacity-95 font-bold text-xs uppercase tracking-wider rounded-xl py-3 px-5 transition-all shadow-sm flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                >
                  <IconImg src="/images/icon-mailwithheart.png" className="w-5 h-5 object-contain" />
                  Add Guest Row
                </button>
                <span className="text-xs text-gray-400 font-medium text-center md:text-left">
                  Add one guest at a time to your list.
                </span>
              </div>

              <div className="flex flex-col gap-2 w-full md:w-auto md:items-end">
                <button
                  type="button"
                  onClick={showPreviewToast}
                  disabled={!smsConsent}
                  className="w-full md:w-auto bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white hover:opacity-95 font-bold text-xs uppercase tracking-wider rounded-xl py-3.5 px-6 disabled:opacity-50 transition-all shadow-md shadow-[#e8449a0c] flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                >
                  <IconImg src="/images/icon-plane.png" className="w-5 h-5 object-contain" />
                  Submit &amp; Send Links
                </button>
                <span className="text-[11px] text-gray-400 font-medium text-center md:text-right w-full md:max-w-xs leading-normal">
                  The account email also receives a copy of the host party link automatically.
                </span>
                <span className="text-[11px] text-gray-400 font-medium text-center md:text-right w-full md:max-w-xs leading-normal">
                  Guests will receive SMS about this event (invitation, reminders, updates). Msg &amp; data rates may
                  apply. Reply STOP to opt out, HELP for help.
                </span>
              </div>
            </div>

            {/* Sent Invites List */}
            <div className="border-t border-gray-100 pt-6 space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sent Invites</h3>
              <div className="overflow-x-auto border border-white/20 rounded-xl">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="bg-white/10 border-b border-white/20 font-bold text-gray-500 uppercase text-[10px] tracking-wider">
                      <th className="p-4">Name</th>
                      <th className="p-4">Phone</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Prediction</th>
                      <th className="p-4">Message</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-white/20 backdrop-blur-sm text-gray-700 font-medium">
                    {guestRows.map((guest) => (
                      <tr key={guest.guestId}>
                        <td className="p-4 flex items-center gap-2">
                          {guest.name}
                          {guest.isHost && (
                            <span className="bg-blue-50 text-[#1B4F8C] text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                              Host
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-gray-500">{guest.phone || "-"}</td>
                        <td className="p-4 text-gray-500">{guest.email}</td>
                        <td className="p-4 font-semibold">
                          {guest.prediction === "boy" ? "💙 Boy" : guest.prediction === "girl" ? "🩷 Girl" : "-"}
                        </td>
                        <td className="p-4 max-w-[200px] truncate text-gray-500">{guest.message || "-"}</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={showPreviewToast}
                            className="border border-gray-200 text-[#374151] hover:bg-gray-50 font-bold text-xs uppercase tracking-wider rounded-lg px-2.5 py-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                          >
                            Resend
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
