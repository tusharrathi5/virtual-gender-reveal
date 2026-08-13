export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { buildGuestInviteEmailHtml } from "@/lib/resendEmail";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production." }, { status: 404 });
  }

  const params = req.nextUrl.searchParams;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || req.nextUrl.origin;
  const revealAtMs = Date.now() + 24 * 60 * 60 * 1000;

  const html = buildGuestInviteEmailHtml({
    to: "preview@example.com",
    guestName: params.get("guestName") || "Jamie",
    parentName: params.get("parentName") || "Adam & Camryn",
    revealAtIso: new Date(revealAtMs).toISOString(),
    revealTimezone: params.get("revealTimezone") || "America/New_York",
    inviteUrl: `${appUrl}/guest/preview-token`,
    googleCalendarUrl: `${appUrl}`,
    icsUrl: `${appUrl}/api/guest/preview-token/calendar.ics`,
  });

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
