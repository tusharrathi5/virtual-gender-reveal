export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import CryptoJS from "crypto-js";
import { saveGender } from "@/lib/secureGenderService";
import { getAdminDb } from "@/lib/firebase-admin";

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

  const enquiryRef = getAdminDb().collection("enquiries").doc(payload.enquiryId);
  const snap = await enquiryRef.get();
  if (!snap.exists) return null;

  const data = snap.data() as { doctorTokenHash?: string | null };
  const hash = CryptoJS.SHA256(token).toString();
  if (!data?.doctorTokenHash || hash !== data.doctorTokenHash) return null;

  return { enquiryId: payload.enquiryId };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token: rawToken } = await params;
    const token = normalizeToken(rawToken);
    const verified = await verifyActiveToken(token);
    if (!verified) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
    return NextResponse.json({ success: true, enquiryId: verified.enquiryId });
  } catch (err) {
    console.error("[doctor-token][GET]", err);
    return NextResponse.json({ error: "Server error validating link" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token: rawToken } = await params;
    const token = normalizeToken(rawToken);
    const verified = await verifyActiveToken(token);
    if (!verified) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });

    const body = await req.json().catch(() => null) as { gender?: string } | null;
    const gender = body?.gender;
    if (!( ["boy", "girl"] as const).includes(gender as "boy" | "girl")) {
      return NextResponse.json({ error: "Invalid gender" }, { status: 400 });
    }

    await saveGender({
      enquiryId: verified.enquiryId,
      gender: gender as "boy" | "girl",
      submittedBy: "revealer",
      submittedByUid: null,
    });

    const nowIso = new Date().toISOString();
    const enquiryRef = getAdminDb().collection("enquiries").doc(verified.enquiryId);
    await enquiryRef.update({
      doctorTokenHash: "",
      doctorConfirmedAt: nowIso,
      genderStatus: "submitted",
      status: "doctor_confirmed",
      "stages.revealerSubmitted": Timestamp.now(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await getAdminDb().collection("email_log").add({
      type: "revealer_submission",
      enquiryId: verified.enquiryId,
      submittedGender: gender,
      submittedAt: nowIso,
      source: "doctor_token",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[doctor-token][POST]", err);
    return NextResponse.json({ error: "Server error submitting gender" }, { status: 500 });
  }
}
