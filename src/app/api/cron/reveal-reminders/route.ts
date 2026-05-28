export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendRevealReminderEmail } from "@/lib/resendEmail";

type ReminderWindow = "7d" | "24h";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const DAILY_CRON_WINDOW_MS = 24 * 60 * 60 * 1000;

function pickReminderWindow(diffMs: number): ReminderWindow | null {
  // Hobby Vercel cron runs once per day, so use rolling 24h windows.
  // 7d reminder: reveal is between 6 and 7 days away.
  if (diffMs > SEVEN_DAYS_MS - DAILY_CRON_WINDOW_MS && diffMs <= SEVEN_DAYS_MS) return "7d";
  // 24h reminder: reveal is within the next 24 hours.
  if (diffMs > 0 && diffMs <= TWENTY_FOUR_HOURS_MS) return "24h";
  return null;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfigured: CRON_SECRET not set." }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = getAdminDb();
  const nowMs = Date.now();
  const maxLookaheadMs = nowMs + SEVEN_DAYS_MS;

  const enquiriesSnap = await db
    .collection("enquiries")
    .where("revealAt", ">=", Timestamp.fromMillis(nowMs))
    .where("revealAt", "<=", Timestamp.fromMillis(maxLookaheadMs))
    .get();

  let scannedEnquiries = 0;
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const enquiryDoc of enquiriesSnap.docs) {
    scannedEnquiries += 1;
    const enquiry = enquiryDoc.data() as {
      parentName?: string;
      revealAt?: Timestamp;
      revealTimezone?: string;
    };

    const revealAt = enquiry.revealAt?.toDate?.();
    if (!revealAt) {
      skippedCount += 1;
      continue;
    }

    const diffMs = revealAt.getTime() - nowMs;
    const reminderWindow = pickReminderWindow(diffMs);
    if (!reminderWindow) {
      skippedCount += 1;
      continue;
    }

    const invitesSnap = await db
      .collection("guest_invites")
      .where("enquiryId", "==", enquiryDoc.id)
      .get();

    for (const inviteDoc of invitesSnap.docs) {
      const invite = inviteDoc.data() as {
        email?: string;
        name?: string;
        reminder7dSentAt?: Timestamp | null;
        reminder24hSentAt?: Timestamp | null;
      };

      const email = invite.email?.trim().toLowerCase();
      if (!email) {
        skippedCount += 1;
        continue;
      }

      if (reminderWindow === "7d" && invite.reminder7dSentAt) {
        skippedCount += 1;
        continue;
      }
      if (reminderWindow === "24h" && invite.reminder24hSentAt) {
        skippedCount += 1;
        continue;
      }

      try {
        await sendRevealReminderEmail({
          to: email,
          guestName: invite.name || "there",
          parentName: enquiry.parentName || "the parents",
          revealAtIso: revealAt.toISOString(),
          revealTimezone: enquiry.revealTimezone || "UTC",
          reminderWindow,
        });

        await inviteDoc.ref.set(
          {
            updatedAt: FieldValue.serverTimestamp(),
            ...(reminderWindow === "7d"
              ? { reminder7dSentAt: FieldValue.serverTimestamp() }
              : { reminder24hSentAt: FieldValue.serverTimestamp() }),
          },
          { merge: true }
        );
        sentCount += 1;
      } catch (error) {
        failedCount += 1;
        console.error(`[cron/reveal-reminders] Failed for enquiry ${enquiryDoc.id} guest ${inviteDoc.id}:`, error);
      }
    }
  }

  return NextResponse.json({
    success: true,
    scannedEnquiries,
    sentCount,
    skippedCount,
    failedCount,
    timestamp: new Date().toISOString(),
  });
}
