export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { validateDoctorToken } from "@/lib/doctorToken";
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

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  try {
    const token = normalizeToken(params.token);
    const payload = validateDoctorToken(token);
    if (!payload) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });

    const db = getFirebaseDb();
    const snap = await getDoc(doc(db, "enquiries", payload.enquiryId));
    if (!snap.exists()) return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });

    const data = snap.data();
    const hash = CryptoJS.SHA256(token).toString();
    if (hash !== data.doctorTokenHash) return NextResponse.json({ error: "Link already used" }, { status: 410 });

    return NextResponse.json({ success: true, enquiryId: payload.enquiryId });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const token = normalizeToken(params.token);
    const payload = validateDoctorToken(token);
    if (!payload) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });

    const { gender } = await req.json();
    if (!(["boy", "girl"] as const).includes(gender)) {
      return NextResponse.json({ error: "Invalid gender" }, { status: 400 });
    }

    const db = getFirebaseDb();
    const ref = doc(db, "enquiries", payload.enquiryId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = snap.data();
    const hash = CryptoJS.SHA256(token).toString();
    if (hash !== data.doctorTokenHash) return NextResponse.json({ error: "Link already used" }, { status: 410 });

    await saveGender({
      enquiryId: payload.enquiryId,
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
