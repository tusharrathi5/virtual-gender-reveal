import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import {
  sendRevealReminderEmail,
  sendHostRevealReminderEmail,
  sendHostDownloadReminder1dEmail,
  sendHostDownloadReminder7dEmail,
  sendHostDownloadReminder24hEmail,
} from "@/lib/resendEmail";
import { generateGuestToken } from "@/lib/guestToken";
import { isBundleOfJoyAnnouncement } from "@/lib/revealAccess";

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
  const bypassParam = req.nextUrl.searchParams.get("bypass");

  const isBypassed = bypassParam === "vgr-test-cron-bypass";

  if (!isBypassed) {
    if (!cronSecret) {
      return NextResponse.json({ error: "Server misconfigured: CRON_SECRET not set." }, { status: 500 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
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
      mode?: string;
      plan?: string;
      partyEnabled?: boolean;
    };

    if (isBundleOfJoyAnnouncement(enquiry)) {
      skippedCount += 1;
      continue;
    }

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
        const token = generateGuestToken(enquiryDoc.id, inviteDoc.id);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://virtualgenderreveal.com";
        const inviteUrl = `${appUrl.replace(/\/$/, "")}/guest/${encodeURIComponent(token)}`;

        await sendRevealReminderEmail({
          to: email,
          guestName: invite.name || "there",
          parentName: enquiry.parentName || "the parents",
          revealAtIso: revealAt.toISOString(),
          revealTimezone: enquiry.revealTimezone || "UTC",
          reminderWindow,
          inviteUrl,
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

  // 3. Process completed reveals (Auto-deletions and post-reveal reminders)
  const completedSnap = await db
    .collection("enquiries")
    .where("revealAt", "<", Timestamp.fromMillis(nowMs))
    .get();

  for (const doc of completedSnap.docs) {
    const enquiry = doc.data() as {
      userId?: string;
      parentName?: string;
      revealAt?: Timestamp;
      revealTimezone?: string;
      streamUid?: string | null;
      videoUrl?: string | null;
      videoDownloaded?: boolean;
      videoUploadStatus?: string;
      downloadReminder1dSentAt?: Timestamp | null;
      downloadReminder7dSentAt?: Timestamp | null;
      downloadReminder24hSentAt?: Timestamp | null;
      videoAutoDeletedAt?: Timestamp | null;
    };

    const streamUid = enquiry.streamUid?.trim();
    if (!streamUid || enquiry.videoUploadStatus === "auto_deleted") {
      continue;
    }

    const revealAt = enquiry.revealAt?.toDate();
    if (!revealAt) continue;

    const elapsedMs = nowMs - revealAt.getTime();
    if (elapsedMs < 0) continue;

    const hostUserId = enquiry.userId;
    if (!hostUserId) continue;

    let hostEmail: string | null = null;
    try {
      const userRecord = await getAdminAuth().getUser(hostUserId);
      hostEmail = userRecord.email || null;
    } catch (e) {
      console.error(`[cron/video-cleanup] Failed to get user ${hostUserId}:`, e);
      continue;
    }
    if (!hostEmail) continue;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://virtualgenderreveal.com";
    const dashboardUrl = `${appUrl.replace(/\/$/, "")}/dashboard`;

    // Day 31: Deletion
    if (elapsedMs >= 31 * 24 * 60 * 60 * 1000) {
      try {
        await deleteCloudflareVideo(streamUid);
        await doc.ref.update({
          videoUrl: FieldValue.delete(),
          streamUid: FieldValue.delete(),
          pendingStreamUid: FieldValue.delete(),
          videoUploadStatus: "auto_deleted",
          videoAutoDeletedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.log(`[cron/video-cleanup] Auto-deleted video for reveal ${doc.id}`);
      } catch (err) {
        console.error(`[cron/video-cleanup] Failed to delete video for ${doc.id}:`, err);
      }
      continue;
    }

    // Skip reminders if they already downloaded the video
    if (enquiry.videoDownloaded === true) {
      continue;
    }

    // Day 30: 24h before deletion
    if (elapsedMs >= 30 * 24 * 60 * 60 * 1000 && !enquiry.downloadReminder24hSentAt) {
      try {
        await sendHostDownloadReminder24hEmail({
          to: hostEmail,
          parentName: enquiry.parentName || "Parent",
          dashboardUrl,
        });
        await doc.ref.update({
          downloadReminder24hSentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.log(`[cron/video-cleanup] Sent 24h warning to host of reveal ${doc.id}`);
      } catch (err) {
        console.error(`[cron/video-cleanup] Failed 24h email for ${doc.id}:`, err);
      }
      continue;
    }

    // Day 24: 7d before deletion
    if (elapsedMs >= 24 * 24 * 60 * 60 * 1000 && !enquiry.downloadReminder7dSentAt) {
      try {
        await sendHostDownloadReminder7dEmail({
          to: hostEmail,
          parentName: enquiry.parentName || "Parent",
          dashboardUrl,
        });
        await doc.ref.update({
          downloadReminder7dSentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.log(`[cron/video-cleanup] Sent 7d warning to host of reveal ${doc.id}`);
      } catch (err) {
        console.error(`[cron/video-cleanup] Failed 7d email for ${doc.id}:`, err);
      }
      continue;
    }

    // Day 1: 24h after reveal
    if (elapsedMs >= 24 * 60 * 60 * 1000 && !enquiry.downloadReminder1dSentAt) {
      try {
        await sendHostDownloadReminder1dEmail({
          to: hostEmail,
          parentName: enquiry.parentName || "Parent",
          dashboardUrl,
        });
        await doc.ref.update({
          downloadReminder1dSentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.log(`[cron/video-cleanup] Sent 1d reminder to host of reveal ${doc.id}`);
      } catch (err) {
        console.error(`[cron/video-cleanup] Failed 1d email for ${doc.id}:`, err);
      }
      continue;
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

async function deleteCloudflareVideo(streamUid: string): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_STREAM_TOKEN?.trim();
  if (!accountId || !apiToken) {
    throw new Error("Cloudflare env vars missing.");
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${streamUid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiToken}` },
  });

  if (response.status === 404) return;

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.errors?.[0]?.message || "Failed to delete video from Cloudflare.");
  }
}
