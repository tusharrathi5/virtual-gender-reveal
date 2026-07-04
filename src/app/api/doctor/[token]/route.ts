export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import CryptoJS from "crypto-js";
import { saveGender } from "@/lib/secureGenderService";
import { getAdminDb } from "@/lib/firebase-admin";
import { validateDoctorToken } from "@/lib/doctorToken";

function normalizeToken(rawToken: string): string {
  try {
    return decodeURIComponent(rawToken).trim().replace(/\s+/g, "");
  } catch {
    return rawToken.trim().replace(/\s+/g, "");
  }
}

async function verifyActiveToken(token: string): Promise<{ enquiryId: string } | null> {
  const payload = validateDoctorToken(token);
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
