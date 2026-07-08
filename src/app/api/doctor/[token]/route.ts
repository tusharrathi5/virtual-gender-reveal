export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import CryptoJS from "crypto-js";
import { saveGender } from "@/lib/secureGenderService";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { validateDoctorToken } from "@/lib/doctorToken";
import { sendParentGenderAlertEmail } from "@/lib/resendEmail";

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
    
    const snap = await enquiryRef.get();
    const data = snap.data();
    const plan = data?.plan;

    const baseUpdate: any = {
      doctorTokenHash: "",
      doctorConfirmedAt: nowIso,
      genderStatus: "submitted",
      status: plan === "basic" ? "completed" : "doctor_confirmed",
      "stages.revealerSubmitted": Timestamp.now(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (plan === "basic") {
      baseUpdate.videoUrl = `https://firebasestorage.googleapis.com/v0/b/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/o/static%2Fvideos%2F${gender}_reveal.mov?alt=media`;
      baseUpdate["stages.videoGenerated"] = Timestamp.now();
    }

    await enquiryRef.update(baseUpdate);

    await getAdminDb().collection("email_log").add({
      type: "revealer_submission",
      enquiryId: verified.enquiryId,
      submittedGender: gender,
      submittedAt: nowIso,
      source: "doctor_token",
      createdAt: FieldValue.serverTimestamp(),
    });

    if (data) {
      try {
        const userRecord = await getAdminAuth().getUser(data.userId);
        const parentEmail = userRecord.email;
        const relationLabels: Record<string, string> = {
          doctor: "doctor",
          relative: "relative",
          friend: "friend",
          other: "designated revealer"
        };
        const relationLabel = relationLabels[data.revealerRelation] || "revealer";
        const appUrl = getAppUrl(req);
        
        if (parentEmail) {
          await sendParentGenderAlertEmail({
            to: parentEmail,
            parentName: data.parentName || "Parent",
            revealerRelation: relationLabel,
            dashboardUrl: `${appUrl}/dashboard`,
          });
        }
      } catch (parentEmailErr) {
        console.error("[doctor-token][POST] Failed to send parent gender alert email:", parentEmailErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[doctor-token][POST]", err);
    return NextResponse.json({ error: "Server error submitting gender" }, { status: 500 });
  }
}

function getAppUrl(req: NextRequest): string {
  const host = req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}
