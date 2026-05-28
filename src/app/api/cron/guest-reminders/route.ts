export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendGuestReminderEmail } from "@/lib/resendEmail";
import { generateGuestToken } from "@/lib/guestToken";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const from = now + 23 * 60 * 60 * 1000;
  const to = now + 25 * 60 * 60 * 1000;
  const enquiriesSnap = await getAdminDb().collection("enquiries").get();
  let sent = 0;
  for (const doc of enquiriesSnap.docs) {
    const e = doc.data() as { revealAt?: { toDate: () => Date }; revealTimezone?: string; parentName?: string };
    const revealAt = e.revealAt?.toDate?.();
    if (!revealAt) continue;
    const ms = revealAt.getTime();
    if (ms < from || ms > to) continue;
    const guests = await getAdminDb().collection("guest_invites").where("enquiryId", "==", doc.id).get();
    for (const gdoc of guests.docs) {
      const g = gdoc.data() as { email?: string; name?: string; reminderSentAt?: unknown; inviteStatus?: string; tokenHash?: string };
      if (!g.email || g.reminderSentAt || g.inviteStatus === "revoked" || !g.tokenHash) continue;
      const token = generateGuestToken(doc.id, gdoc.id);
      const inviteUrl = `${(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")}/guest/${encodeURIComponent(token)}`;
      await sendGuestReminderEmail({
        to: g.email,
        guestName: g.name || "Guest",
        parentName: e.parentName || "the parents",
        revealAtIso: revealAt.toISOString(),
        revealTimezone: e.revealTimezone || "UTC",
        inviteUrl,
      });
      await gdoc.ref.update({ reminderSentAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      sent += 1;
    }
  }
  return NextResponse.json({ success: true, sent });
}
