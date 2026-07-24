export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthHeader } from "@/lib/authServer";
import { getStreamMp4Download } from "@/lib/cloudflareStream";
import { getAdminDb } from "@/lib/firebase-admin";
import { isBundleOfJoyAnnouncement } from "@/lib/revealAccess";

type DownloadableEnquiry = {
  userId?: string;
  mode?: string;
  plan?: string;
  partyEnabled?: boolean;
  streamUid?: string | null;
};

function withFilename(url: string, enquiryId: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set(
    "filename",
    `personalized-announcement-${enquiryId}.mp4`
  );
  return parsed.toString();
}

export async function POST(req: NextRequest) {
  const session = await verifyAuthHeader(req.headers.get("Authorization"));
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { enquiryId } = (await req.json().catch(() => ({}))) as {
    enquiryId?: string;
  };
  const id = enquiryId?.trim();
  if (!id) {
    return NextResponse.json(
      { error: "enquiryId is required." },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const enquiryRef = db.collection("enquiries").doc(id);
  const snap = await enquiryRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Reveal not found." }, { status: 404 });
  }

  const enquiry = snap.data() as DownloadableEnquiry;
  if (enquiry.userId !== session.uid) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (!isBundleOfJoyAnnouncement(enquiry)) {
    return NextResponse.json(
      { error: "This download link is only used for personalized announcements." },
      { status: 400 }
    );
  }
  if (!enquiry.streamUid) {
    return NextResponse.json(
      { error: "The personalized video has not been uploaded yet." },
      { status: 409 }
    );
  }

  try {
    const download = await getStreamMp4Download(enquiry.streamUid);
    if (!download.ready || !download.url) {
      return NextResponse.json(
        {
          ready: false,
          message:
            "Your video is uploaded and its mobile download is still being prepared. Please try again shortly.",
        },
        { status: 202 }
      );
    }

    const downloadUrl = withFilename(download.url, id);
    await enquiryRef.update({
      downloadUrl,
      videoDownloaded: true,
      videoDownloadedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      { ready: true, downloadUrl },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(`[download-link] Failed for ${id}:`, error);
    return NextResponse.json(
      { error: "We could not prepare the mobile download. Please try again." },
      { status: 502 }
    );
  }
}
