import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { sendRevealReminderEmail, sendHostRevealReminderEmail } from "@/lib/resendEmail";

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
      userId?: string;
      hostReminder24hSentAt?: Timestamp | null;
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

    // 1. Send Host Reminder if 24h window matches and not yet sent
    if (reminderWindow === "24h" && !enquiry.hostReminder24hSentAt && enquiry.userId) {
      try {
        const userRecord = await getAdminAuth().getUser(enquiry.userId);
        const hostEmail = userRecord.email;
        if (hostEmail) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://virtualgenderreveal.com";

          // Fetch vote stats
          const predictionsSnap = await db
            .collection("predictions")
            .where("enquiryId", "==", enquiryDoc.id)
            .get();
          let boyVotes = 0;
          let girlVotes = 0;
          for (const predDoc of predictionsSnap.docs) {
            const pred = predDoc.data()?.prediction;
            if (pred === "boy") boyVotes++;
            else if (pred === "girl") girlVotes++;
          }

          await sendHostRevealReminderEmail({
            to: hostEmail,
            parentName: enquiry.parentName || "Parent",
            revealAtIso: revealAt.toISOString(),
            revealTimezone: enquiry.revealTimezone || "UTC",
            dashboardUrl: `${appUrl}/dashboard`,
            boyVotes,
            girlVotes,
          });

          await enquiryDoc.ref.update({
            hostReminder24hSentAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          sentCount += 1;
        }
      } catch (hostErr) {
        failedCount += 1;
        console.error(`[cron/reveal-reminders] Failed for host of enquiry ${enquiryDoc.id}:`, hostErr);
      }
    }

    // 2. Send Guest Reminders
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
