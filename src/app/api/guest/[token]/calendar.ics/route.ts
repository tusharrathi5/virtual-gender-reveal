export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import CryptoJS from "crypto-js";
import { getAdminDb } from "@/lib/firebase-admin";
import { parseGuestToken } from "@/lib/guestToken";

function normalize(raw: string) { try { return decodeURIComponent(raw).trim(); } catch { return raw.trim(); } }
function toICSDate(d: Date): string { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }
function toLocalICSDate(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(d);
  const get=(t:string)=>parts.find(p=>p.type===t)?.value||"00";
  return `${get("year")}${get("month")}${get("day")}T${get("hour")}${get("minute")}${get("second")}`;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = normalize(raw);
  const payload = parseGuestToken(token);
  if (!payload) return new NextResponse("Invalid invite", { status: 401 });
  const guestRef = getAdminDb().collection("guest_invites").doc(payload.guestId);
  const guest = await guestRef.get();
  const isHost = Boolean(guest.data()?.isHost);
  if (!guest.exists || (!isHost && (guest.data()?.tokenHash as string) !== CryptoJS.SHA256(token).toString())) {
    return new NextResponse("Invalid invite", { status: 401 });
  }
  const enquiry = await getAdminDb().collection("enquiries").doc(payload.enquiryId).get();
  if (!enquiry.exists) return new NextResponse("Reveal not found", { status: 404 });
  const data = enquiry.data() as { parentName?: string; revealAt?: { toDate: () => Date }; revealTimezone?: string };
  const start = data.revealAt?.toDate?.() ?? new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const title = `${data.parentName || "Parents"}'s Virtual Gender Reveal`;
  const timezone = data.revealTimezone || "UTC";
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Virtual Gender Reveal//EN\nBEGIN:VEVENT\nUID:${payload.enquiryId}-${payload.guestId}@virtualgenderreveal\nDTSTAMP:${toICSDate(new Date())}\nDTSTART;TZID=${timezone}:${toLocalICSDate(start, timezone)}\nDTEND;TZID=${timezone}:${toLocalICSDate(end, timezone)}\nSUMMARY:${title}\nDESCRIPTION:Join the reveal celebration\nEND:VEVENT\nEND:VCALENDAR`;
  return new NextResponse(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="reveal.ics"' } });
}
