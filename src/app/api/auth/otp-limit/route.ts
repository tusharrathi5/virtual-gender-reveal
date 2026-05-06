export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

const DAILY_LIMIT = 3;

type OtpLimitBody = { phone?: string; action?: "check" | "consume" };

function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as OtpLimitBody | null;
  const phone = body?.phone ? normalizePhone(body.phone) : "";
  const action = body?.action ?? "check";

  if (!phone) return NextResponse.json({ error: "Phone is required." }, { status: 400 });
  if (!["check", "consume"].includes(action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const day = new Date().toISOString().slice(0, 10);
  const key = `${phone}_${day}`;
  const ref = getAdminDb().collection("otp_requests").doc(key);

  const result = await getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? ((snap.data()?.count as number) ?? 0) : 0;

    if (count >= DAILY_LIMIT) {
      return { allowed: false, remaining: 0, count };
    }

    if (action === "consume") {
      const newCount = count + 1;
      tx.set(ref, {
        phone,
        day,
        count: newCount,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: snap.exists ? snap.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      }, { merge: true });
      return { allowed: true, remaining: DAILY_LIMIT - newCount, count: newCount };
    }

    return { allowed: true, remaining: DAILY_LIMIT - count, count };
  });

  if (!result.allowed) {
    return NextResponse.json({ error: "OTP request limit reached for today (3/day).", remaining: 0 }, { status: 429 });
  }

  return NextResponse.json({ success: true, remaining: result.remaining, consumed: action === "consume" });
}
