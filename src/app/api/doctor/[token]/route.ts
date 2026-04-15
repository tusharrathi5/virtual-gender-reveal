export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { validateDoctorToken, encryptGender } from "@/lib/doctorToken";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import CryptoJS from "crypto-js";

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
    try {
          const payload = validateDoctorToken(params.token);
          if (!payload) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
          const db = getFirebaseDb();
          const snap = await getDoc(doc(db, "enquiries", payload.enquiryId));
          if (!snap.exists()) return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
          const data = snap.data();
          const hash = CryptoJS.SHA256(params.token).toString();
          if (hash !== data.doctorTokenHash) return NextResponse.json({ error: "Link already used" }, { status: 410 });
          return NextResponse.json({ babyNickname: data.babyNickname, parentNames: data.parentNames, dueDate: data.dueDate });
    } catch { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
    try {
          const payload = validateDoctorToken(params.token);
          if (!payload) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
          const { gender } = await req.json();
          if (!["boy", "girl"].includes(gender)) return NextResponse.json({ error: "Invalid gender" }, { status: 400 });
          const db = getFirebaseDb();
          const ref = doc(db, "enquiries", payload.enquiryId);
          const snap = await getDoc(ref);
          if (!snap.exists()) return NextResponse.json({ error: "Not found" }, { status: 404 });
          const data = snap.data();
          const hash = CryptoJS.SHA256(params.token).toString();
          if (hash !== data.doctorTokenHash) return NextResponse.json({ error: "Link already used" }, { status: 410 });
          await updateDoc(ref, { genderEncrypted: encryptGender(gender as "boy" | "girl"), doctorTokenHash: "", doctorConfirmedAt: new Date().toISOString(), status: "doctor_confirmed", updatedAt: serverTimestamp() });
          return NextResponse.json({ success: true });
    } catch { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
