export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import CryptoJS from "crypto-js";
import { getAdminDb } from "@/lib/firebase-admin";
import { parseGuestToken } from "@/lib/guestToken";
import { FieldValue } from "firebase-admin/firestore";
import {
  isBundleOfJoyAnnouncement,
  PARTY_UNAVAILABLE_MESSAGE,
} from "@/lib/revealAccess";

function normalize(raw: string) { try { return decodeURIComponent(raw).trim(); } catch { return raw.trim(); } }

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = normalize(raw);
  const payload = parseGuestToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid or expired invite." }, { status: 401 });

  const guestRef = getAdminDb().collection("guest_invites").doc(payload.guestId);
  const guest = await guestRef.get();
  if (!guest.exists) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  const isHost = Boolean(guest.data()?.isHost);
  if (!isHost && (guest.data()?.tokenHash as string) !== CryptoJS.SHA256(token).toString()) {
    return NextResponse.json({ error: "Invalid invite." }, { status: 401 });
  }

  const enquiry = await getAdminDb().collection("enquiries").doc(payload.enquiryId).get();
  if (!enquiry.exists) return NextResponse.json({ error: "Reveal not found." }, { status: 404 });

  const data = enquiry.data() as {
    parentName?: string;
    revealAt?: { toDate: () => Date };
    revealTimezone?: string;
    videoUrl?: string | null;
    stages?: { eventCompleted?: unknown };
    mode?: string;
    plan?: string;
    partyEnabled?: boolean;
    registryUrl?: string | null;
  };
  if (isBundleOfJoyAnnouncement(data)) {
    return NextResponse.json(
      { error: PARTY_UNAVAILABLE_MESSAGE },
      { status: 409 }
    );
  }
  const revealAt = data.revealAt?.toDate?.() ?? null;
  const isLive = !!revealAt && Date.now() >= revealAt.getTime();
  const isCompleted = Boolean(data?.stages?.eventCompleted);

  const browserId = req.nextUrl.searchParams.get("browserId");
  let clientPrediction = null;
  if (browserId) {
    const voteSnap = await getAdminDb().collection("predictions").doc(`${payload.enquiryId}_${browserId}`).get();
    if (voteSnap.exists) {
      clientPrediction = voteSnap.data()?.prediction || null;
    }
  }

  const feedSnap = await getAdminDb().collection("guest_invites").where("enquiryId", "==", payload.enquiryId).get();
  const feed = feedSnap.docs
    .map((d) => d.data() as { name?: string; message?: string | null; isAdminPartyLink?: boolean; updatedAt?: { toDate?: () => Date } })
    .filter((m) => !m.isAdminPartyLink && m.message)
    .sort((a, b) => (b.updatedAt?.toDate?.().getTime?.() || 0) - (a.updatedAt?.toDate?.().getTime?.() || 0))
    .slice(0, 20)
    .map((m) => ({ name: m.name || "Guest", message: m.message || "" }));
  
  let boyVotes = 0;
  let girlVotes = 0;

  const predictionsSnap = await getAdminDb().collection("predictions").where("enquiryId", "==", payload.enquiryId).get();
  const predictionGuestIds = new Set<string>();

  predictionsSnap.docs.forEach((doc) => {
    const d = doc.data() as { prediction?: string | null; guestId?: string };
    if (d.prediction === "boy") boyVotes++;
    if (d.prediction === "girl") girlVotes++;
    if (d.guestId) {
      predictionGuestIds.add(d.guestId);
    }
    predictionGuestIds.add(doc.id);
  });

  feedSnap.docs.forEach((doc) => {
    const d = doc.data() as { prediction?: string | null; isAdminPartyLink?: boolean };
    if (!d.isAdminPartyLink) {
      if (!predictionGuestIds.has(doc.id)) {
        if (d.prediction === "boy") boyVotes++;
        if (d.prediction === "girl") girlVotes++;
      }
    }
  });

  const invitedGuests = feedSnap.docs
    .map((d) => d.data() as { name?: string; inviteStatus?: string; isAdminPartyLink?: boolean; createdAt?: { toDate?: () => Date } })
    .filter((m) => !m.isAdminPartyLink && m.inviteStatus !== "revoked")
    .sort((a, b) => (a.createdAt?.toDate?.().getTime?.() || 0) - (b.createdAt?.toDate?.().getTime?.() || 0))
    .map((m) => ({ name: m.name || "Guest" }));
  return NextResponse.json({
    success: true,
    guest: { name: guest.data()?.name },
    response: {
      prediction: (clientPrediction || (guest.data()?.prediction as "boy" | "girl" | null)) ?? null,
      message: (guest.data()?.message as string | null) ?? null,
      submittedAt: guest.data()?.joinedAt ?? null,
    },
    reveal: {
      id: payload.enquiryId,
      parentName: data.parentName || "Parents",
      revealAtIso: revealAt?.toISOString?.() || null,
      revealTimezone: data.revealTimezone || "UTC",
      isLive,
      isCompleted,
      videoUrl: isLive ? data.videoUrl || null : null,
      registryUrl: data.plan !== "basic" ? data.registryUrl || null : null,
    },
    votes: {
      boy: boyVotes,
      girl: girlVotes,
      total: boyVotes + girlVotes,
    },
    feed,
    invitedGuests,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = normalize(raw);
  const payload = parseGuestToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid or expired invite." }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    prediction?: "boy" | "girl";
    message?: string;
    browserId?: string;
  } | null;
  const prediction = body?.prediction;
  const message = body?.message?.trim() || null;
  if (prediction !== "boy" && prediction !== "girl") return NextResponse.json({ error: "Prediction required." }, { status: 400 });

  const guestRef = getAdminDb().collection("guest_invites").doc(payload.guestId);
  const guest = await guestRef.get();
  if (!guest.exists) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  const isHost = Boolean(guest.data()?.isHost);
  if (!isHost && (guest.data()?.tokenHash as string) !== CryptoJS.SHA256(token).toString()) return NextResponse.json({ error: "Invalid invite." }, { status: 401 });
  if (guest.data()?.prediction) {
    return NextResponse.json({ error: "Response already submitted." }, { status: 409 });
  }

  const enquirySnap = await getAdminDb()
    .collection("enquiries")
    .doc(payload.enquiryId)
    .get();
  if (!enquirySnap.exists) {
    return NextResponse.json({ error: "Reveal not found." }, { status: 404 });
  }
  if (isBundleOfJoyAnnouncement(enquirySnap.data())) {
    return NextResponse.json(
      { error: PARTY_UNAVAILABLE_MESSAGE },
      { status: 409 }
    );
  }

  const browserId = body?.browserId;
  const browserIdClean = typeof browserId === "string" ? browserId.trim() : null;
  const voteId = browserIdClean ? `${payload.enquiryId}_${browserIdClean}` : payload.guestId;

  await getAdminDb().collection("predictions").doc(voteId).set({
    id: voteId,
    enquiryId: payload.enquiryId,
    guestId: payload.guestId,
    prediction,
    createdAt: FieldValue.serverTimestamp(),
  });

  await guestRef.update({ prediction, message, joinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  return NextResponse.json({ success: true });
}
