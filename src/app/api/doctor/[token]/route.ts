export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import CryptoJS from "crypto-js";
import { saveGender } from "@/lib/secureGenderService";

function normalizeToken(rawToken: string): string {
  try {
    return decodeURIComponent(rawToken).trim().replace(/\s+/g, "");
  } catch {
    return rawToken.trim().replace(/\s+/g, "");
  }
}

function decodeTokenPayload(token: string): { enquiryId: string; exp: number } | null {
  try {
    const [encoded] = token.split(".");
    if (!encoded) return null;
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!decoded?.enquiryId || typeof decoded?.exp !== "number") return null;
    if (Date.now() > decoded.exp) return null;
    return { enquiryId: decoded.enquiryId, exp: decoded.exp };
  } catch {
    return null;
  }
}

async function verifyActiveToken(token: string): Promise<{ enquiryId: string } | null> {
  const payload = decodeTokenPayload(token);
  if (!payload) return null;

  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, "enquiries", payload.enquiryId));
  if (!snap.exists()) return null;

  const data = snap.data();
  const hash = CryptoJS.SHA256(token).toString();
  if (hash !== data.doctorTokenHash) return null;

  return { enquiryId: payload.enquiryId };
}

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  try {
    const token = normalizeToken(params.token);
    const verified = await verifyActiveToken(token);
    if (!verified) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
    return NextResponse.json({ success: true, enquiryId: verified.enquiryId });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const token = normalizeToken(params.token);
    const verified = await verifyActiveToken(token);
    if (!verified) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });

    const { gender } = await req.json();
    if (!( ["boy", "girl"] as const).includes(gender)) {
      return NextResponse.json({ error: "Invalid gender" }, { status: 400 });
    }

    const db = getFirebaseDb();
    const ref = doc(db, "enquiries", verified.enquiryId);

    await saveGender({
      enquiryId: verified.enquiryId,
      gender,
      submittedBy: "doctor",
      submittedByUid: null,
    });

    await updateDoc(ref, {
      doctorTokenHash: "",
      doctorConfirmedAt: new Date().toISOString(),
      genderStatus: "submitted",
      status: "doctor_confirmed",
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
