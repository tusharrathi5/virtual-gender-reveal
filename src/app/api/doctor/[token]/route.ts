import { NextRequest, NextResponse } from "next/server";
import { validateDoctorToken, encryptGender } from "@/lib/doctorToken";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import CryptoJS from "crypto-js";

const SECRET = process.env.DOCTOR_LINK_SECRET!;

// GET /api/doctor/[token] — validate token, return enquiry summary
export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const payload = validateDoctorToken(params.token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const snap = await getDoc(doc(db, "enquiries", payload.enquiryId));
  if (!snap.exists()) {
    return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
  }

  const data = snap.data();

  // Verify token hash matches stored hash
  const hash = CryptoJS.SHA256(params.token).toString();
  if (hash !== data.doctorTokenHash) {
    return NextResponse.json({ error: "Link already used" }, { status: 410 });
  }

  return NextResponse.json({
    babyNickname: data.babyNickname,
    parentNames: data.parentNames,
    dueDate: data.dueDate,
  });
}

// POST /api/doctor/[token] — submit gender confirmation
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const payload = validateDoctorToken(params.token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const { gender } = await req.json();
  if (!["boy", "girl"].includes(gender)) {
    return NextResponse.json({ error: "Invalid gender value" }, { status: 400 });
  }

  const ref = doc(db, "enquiries", payload.enquiryId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = snap.data();
  const hash = CryptoJS.SHA256(params.token).toString();
  if (hash !== data.doctorTokenHash) {
    return NextResponse.json({ error: "Link already used" }, { status: 410 });
  }

  // Encrypt gender + invalidate token by clearing hash
  await updateDoc(ref, {
    genderEncrypted: encryptGender(gender as "boy" | "girl"),
    doctorTokenHash: "", // invalidate — one-time use
    doctorConfirmedAt: new Date().toISOString(),
    status: "doctor_confirmed",
    updatedAt: serverTimestamp(),
  });

  return NextResponse.json({ success: true });
}
