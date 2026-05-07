export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyGuestInviteToken } from "@/lib/guestInviteAuth";

const MAX_CHAT_MESSAGE_LENGTH = 500;
const CHAT_COOLDOWN_MS = 2000;

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const invite = await verifyGuestInviteToken(raw);
  if (!invite.ok) return NextResponse.json({ error: invite.error }, { status: invite.status });

  const body = await req.json().catch(() => null) as { message?: string } | null;
  const message = typeof body?.message === "string" ? body.message.replace(/\s+/g, " ").trim() : "";
  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });
  if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or fewer.` }, { status: 400 });
  }

  const lastChatAt = invite.guestData.lastChatAt?.toDate?.() ?? null;
  if (lastChatAt && Date.now() - lastChatAt.getTime() < CHAT_COOLDOWN_MS) {
    return NextResponse.json({ error: "Please wait a moment before sending another message." }, { status: 429 });
  }

  const db = getAdminDb();
  const chatRef = db.collection("enquiries").doc(invite.enquiryId).collection("guest_chats").doc();
  await chatRef.set({
    enquiryId: invite.enquiryId,
    guestId: invite.guestId,
    name: invite.guestName,
    message,
    createdAt: FieldValue.serverTimestamp(),
  });

  await invite.guestRef.update({
    lastChatAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true, messageId: chatRef.id });
}
