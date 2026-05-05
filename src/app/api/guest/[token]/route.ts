export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import CryptoJS from "crypto-js";
import { getAdminDb } from "@/lib/firebase-admin";
import { parseGuestToken } from "@/lib/guestToken";
import { FieldValue } from "firebase-admin/firestore";

function normalize(raw: string) { try { return decodeURIComponent(raw).trim(); } catch { return raw.trim(); } }

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = normalize(raw);
  const payload = parseGuestToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid or expired invite." }, { status: 401 });

  const guestRef = getAdminDb().collection("guest_invites").doc(payload.guestId);
  const guest = await guestRef.get();
  if (!guest.exists) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  if ((guest.data()?.tokenHash as string) !== CryptoJS.SHA256(token).toString()) {
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
  };
  const revealAt = data.revealAt?.toDate?.() ?? null;
  const isLive = !!revealAt && Date.now() >= revealAt.getTime();
  const isCompleted = Boolean(data?.stages?.eventCompleted);
  const feedSnap = await getAdminDb().collection("guest_invites").where("enquiryId", "==", payload.enquiryId).get();
  const feed = feedSnap.docs
    .map((d) => d.data() as { name?: string; message?: string | null; updatedAt?: { toDate?: () => Date } })
    .filter((m) => m.message)
    .sort((a, b) => (b.updatedAt?.toDate?.().getTime?.() || 0) - (a.updatedAt?.toDate?.().getTime?.() || 0))
    .slice(0, 20)
    .map((m) => ({ name: m.name || "Guest", message: m.message || "" }));
  return NextResponse.json({
    success: true,
    guest: { name: guest.data()?.name },
    response: {
      prediction: (guest.data()?.prediction as "boy" | "girl" | null) ?? null,
      message: (guest.data()?.message as string | null) ?? null,
      submittedAt: guest.data()?.joinedAt ?? null,
    },
    reveal: {
      parentName: data.parentName || "Parents",
      revealAtIso: revealAt?.toISOString?.() || null,
      revealTimezone: data.revealTimezone || "UTC",
      isLive,
      isCompleted,
      videoUrl: isLive ? data.videoUrl || null : null,
    },
    feed,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = normalize(raw);
  const payload = parseGuestToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid or expired invite." }, { status: 401 });

  const body = await req.json().catch(() => null) as { prediction?: "boy"|"girl"; message?: string } | null;
  const prediction = body?.prediction;
  const message = body?.message?.trim() || null;
  if (prediction !== "boy" && prediction !== "girl") return NextResponse.json({ error: "Prediction required." }, { status: 400 });

  const guestRef = getAdminDb().collection("guest_invites").doc(payload.guestId);
  const guest = await guestRef.get();
  if (!guest.exists) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  if ((guest.data()?.tokenHash as string) !== CryptoJS.SHA256(token).toString()) return NextResponse.json({ error: "Invalid invite." }, { status: 401 });
  if (guest.data()?.prediction) {
    return NextResponse.json({ error: "Response already submitted." }, { status: 409 });
  }

  await guestRef.update({ prediction, message, joinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  return NextResponse.json({ success: true });
}
