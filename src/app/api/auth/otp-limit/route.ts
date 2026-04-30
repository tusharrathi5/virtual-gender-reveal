export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

const DAILY_LIMIT = 3;

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { phone?: string } | null;
  const phone = body?.phone ? normalizePhone(body.phone) : "";
  if (!phone) return NextResponse.json({ error: "Phone is required." }, { status: 400 });

  const day = new Date().toISOString().slice(0, 10);
  const key = `${phone}_${day}`;
  const ref = getAdminDb().collection("otp_requests").doc(key);

  const remaining = await getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? ((snap.data()?.count as number) ?? 0) : 0;
    if (count >= DAILY_LIMIT) return -1;
    tx.set(ref, {
      phone,
      day,
      count: count + 1,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: snap.exists ? snap.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
    }, { merge: true });
    return DAILY_LIMIT - (count + 1);
  });

  if (remaining < 0) return NextResponse.json({ error: "OTP request limit reached for today (3/day)." }, { status: 429 });
  return NextResponse.json({ success: true, remaining });
}
