"use client";

import { useState } from "react";
import Link from "next/link";

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

export default function SmsConsentPage() {
  const [consent, setConsent] = useState(false);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#FDF6FB] to-[#EFF6FE] font-jakarta">
      <div className="max-w-2xl mx-auto px-6 py-14 md:py-20">
        <Link href="/" className="text-xs font-bold text-[#3A9FE8] uppercase tracking-widest hover:underline">
          ← Back to Virtual Gender Reveal
        </Link>

        <h1 className="font-nunito font-extrabold text-3xl md:text-4xl text-gray-900 mt-4 mb-2">
          SMS Consent &amp; Guest Invitations
        </h1>
        <p className="text-sm text-gray-600 font-semibold mb-10 leading-relaxed">
          Hosts on Virtual Gender Reveal invite their guests to a private event page by entering each guest&apos;s name,
          phone number, and/or email in their dashboard. This page shows exactly what a host sees and agrees to before any
          text message is sent, so you can review the opt-in flow without needing to sign in.
        </p>

        {/* Guest form preview */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 shadow-lg rounded-2xl p-5 md:p-6 mb-6">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Invite Guests (preview)</h2>
          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 font-bold text-gray-500 uppercase text-[10px] tracking-wider">
                  <th className="p-3">Name</th>
                  <th className="p-3">Phone Number</th>
                  <th className="p-3">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="p-3 text-gray-700 font-medium">Jamie Smith</td>
                  <td className="p-3 text-gray-700 font-medium">(555) 123-4567</td>
                  <td className="p-3 text-gray-700 font-medium">jamie@example.com</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Consent block — mirrors src/app/dashboard/page.tsx Invite Guests section */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 shadow-lg rounded-2xl p-5 md:p-6 space-y-3 mb-6">
          <label className="flex items-start gap-3 cursor-pointer select-none bg-gray-50/60 border border-gray-100 rounded-xl p-4">
            <IconImg src="/images/icon-shieldWithHeart.png" className="w-14 h-14 object-contain shrink-0" />
            <span className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 rounded border-gray-300 text-[#E8449A] focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] cursor-pointer"
              />
              <span className="text-[11px] text-gray-500 font-medium leading-normal">
                <strong className="text-gray-700 block mb-1">
                  I confirm I have this recipient&apos;s consent to receive SMS from VG Reveal Corp.
                </strong>
                By checking this box, you confirm the recipient agreed to receive text messages about this Virtual Gender
                Reveal event — including their invitation, event reminders, and event updates. Message frequency varies
                by event. Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help.
              </span>
            </span>
          </label>
          <p className="text-[11px] text-gray-400 font-medium pl-4">
            See our{" "}
            <Link href="/privacy-policy" className="text-[#3A9FE8] font-bold hover:underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="text-[#3A9FE8] font-bold hover:underline">
              Terms of Service
            </Link>
            .
          </p>

          <button
            type="button"
            disabled={!consent}
            className="w-full bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white font-bold text-xs uppercase tracking-wider rounded-xl py-3.5 px-6 disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2"
          >
            <IconImg src="/images/icon-plane.png" className="w-5 h-5 object-contain" />
            Submit &amp; Send Links
          </button>
          <p className="text-[11px] text-gray-400 font-medium text-center leading-normal">
            Guests will receive SMS about this event (invitation, reminders, updates). Msg &amp; data rates may apply.
            Reply STOP to opt out, HELP for help.
          </p>
        </div>

        {/* Sample message */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 shadow-lg rounded-2xl p-5 md:p-6">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Sample Message</h2>
          <div className="bg-[#DCF8C6] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800 max-w-md leading-relaxed">
            VG Reveal Corp: Hi Jamie! Alex &amp; Sam invited you to their Gender Reveal on Sep 20, 4:00 PM PDT. View &amp;
            predict here: https://virtualgenderreveal.com/guest/abc123 Reply STOP to opt out, HELP for help.
          </div>
          <p className="text-[11px] text-gray-400 font-medium mt-3">
            Message and data rates may apply. Message frequency varies. Reply STOP to opt out at any time, or HELP for
            help.
          </p>
        </div>
      </div>
    </main>
  );
}
