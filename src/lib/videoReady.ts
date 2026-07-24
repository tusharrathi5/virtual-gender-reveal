import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import {
  buildStreamWatchUrl,
  enableStreamMp4Download,
} from "@/lib/cloudflareStream";
import { isBundleOfJoyAnnouncement } from "@/lib/revealAccess";
import {
  sendHostAnnouncementVideoReadyEmail,
  sendHostVideoReadyEmail,
} from "@/lib/resendEmail";

type ReadyEnquiry = {
  userId?: string;
  parentName?: string;
  mode?: string;
  plan?: string;
  partyEnabled?: boolean;
  revealAt?: Timestamp | null;
  revealTimezone?: string | null;
  streamUid?: string | null;
  videoReadyEmailSentAt?: Timestamp | null;
};

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    "https://virtualgenderreveal.com"
  );
}

export async function finalizeUploadedVideo(params: {
  enquiryId: string;
  streamUid: string;
}): Promise<{
  videoUrl: string;
  downloadUrl: string | null;
  alreadyFinalized: boolean;
}> {
  const { enquiryId, streamUid } = params;
  const db = getAdminDb();
  const enquiryRef = db.collection("enquiries").doc(enquiryId);
  const enquirySnap = await enquiryRef.get();
  if (!enquirySnap.exists) throw new Error("ENQUIRY_NOT_FOUND");

  const enquiry = enquirySnap.data() as ReadyEnquiry;
  const paidAnnouncement = isBundleOfJoyAnnouncement(enquiry);
  const videoUrl = buildStreamWatchUrl(streamUid);
  const baseDownloadUrl = paidAnnouncement
    ? await enableStreamMp4Download(streamUid)
    : null;
  const downloadUrl = baseDownloadUrl
    ? `${baseDownloadUrl}${
        baseDownloadUrl.includes("?") ? "&" : "?"
      }filename=personalized-announcement-${enquiryId}`
    : null;
  const alreadyFinalized =
    enquiry.streamUid === streamUid && Boolean(enquiry.videoReadyEmailSentAt);

  await enquiryRef.update({
    videoUrl,
    downloadUrl,
    streamUid,
    pendingStreamUid: FieldValue.delete(),
    videoUploadStatus: "uploaded",
    status: paidAnnouncement ? "completed" : "video_ready",
    videoReadyAt: Timestamp.now(),
    "stages.videoGenerated": Timestamp.now(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (!alreadyFinalized && enquiry.userId) {
    try {
      const userRecord = await getAdminAuth().getUser(enquiry.userId);
      const hostEmail = userRecord.email;
      if (hostEmail) {
        const dashboardUrl = `${getAppUrl()}/dashboard`;
        if (paidAnnouncement && downloadUrl) {
          await sendHostAnnouncementVideoReadyEmail({
            to: hostEmail,
            parentName: enquiry.parentName || "Parent",
            downloadUrl,
            dashboardUrl,
          });
        } else {
          await sendHostVideoReadyEmail({
            to: hostEmail,
            parentName: enquiry.parentName || "Parent",
            revealAtIso:
              enquiry.revealAt?.toDate().toISOString() ||
              new Date().toISOString(),
            revealTimezone: enquiry.revealTimezone || "UTC",
            dashboardUrl,
          });
        }
        await enquiryRef.update({
          videoReadyEmailSentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (emailErr) {
      console.error(
        `[video-ready] Failed to send host email for ${enquiryId}:`,
        emailErr
      );
    }
  }

  return { videoUrl, downloadUrl, alreadyFinalized };
}
