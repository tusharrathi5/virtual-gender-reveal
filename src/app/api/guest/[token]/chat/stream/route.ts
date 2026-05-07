export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyGuestInviteToken } from "@/lib/guestInviteAuth";

type ChatDoc = {
  name?: string;
  message?: string;
  createdAt?: { toDate?: () => Date };
};

function encodeEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const invite = await verifyGuestInviteToken(raw);
  if (!invite.ok) return NextResponse.json({ error: invite.error }, { status: invite.status });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let active = true;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (!active) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(event, data)));
        } catch {
          active = false;
        }
      };

      const cleanup = () => {
        if (!active) return;
        active = false;
        if (heartbeat) clearInterval(heartbeat);
        if (unsubscribe) unsubscribe();
        try {
          controller.close();
        } catch {}
      };

      unsubscribe = getAdminDb()
        .collection("enquiries")
        .doc(invite.enquiryId)
        .collection("guest_chats")
        .orderBy("createdAt", "asc")
        .limitToLast(50)
        .onSnapshot(
          (snapshot) => {
            const messages = snapshot.docs.map((doc) => {
              const data = doc.data() as ChatDoc;
              return {
                id: doc.id,
                name: data.name || "Guest",
                message: data.message || "",
                createdAtIso: data.createdAt?.toDate?.()?.toISOString?.() || null,
              };
            });
            send("messages", messages);
          },
          (error) => {
            console.error("[guest-chat-stream] Firestore stream failed", error);
            send("stream-error", { error: "Chat stream interrupted." });
            cleanup();
          },
        );

      heartbeat = setInterval(() => send("ping", { ts: Date.now() }), 25000);
      req.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      active = false;
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
