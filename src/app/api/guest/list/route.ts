export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader } from "@/lib/authServer";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const session = await verifyAuthHeader(req.headers.get("Authorization"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const enquiryId = req.nextUrl.searchParams.get("enquiryId")?.trim();
  if (!enquiryId) return NextResponse.json({ error: "enquiryId is required." }, { status: 400 });

  const enquiryRef = getAdminDb().collection("enquiries").doc(enquiryId);
  const enquirySnap = await enquiryRef.get();
  if (!enquirySnap.exists) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  const enquiry = enquirySnap.data() as { userId: string; revealAt?: { toDate: () => Date } };
  if (enquiry.userId !== session.uid) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const revealAt = enquiry.revealAt?.toDate?.() ?? null;
  const revealUnlocked = !!revealAt && Date.now() >= revealAt.getTime();

  const snap = await getAdminDb().collection("guest_invites").where("enquiryId", "==", enquiryId).get();
  const guests = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const prediction = typeof data.prediction === "string" ? data.prediction : null;
    const message = typeof data.message === "string" ? data.message : null;
    return {
      guestId: d.id,
      name: (data.name as string) ?? "",
      email: (data.email as string) ?? "",
      inviteStatus: (data.inviteStatus as string) ?? "sent",
      responded: !!prediction,
      prediction: revealUnlocked ? prediction : null,
      message: revealUnlocked ? message : null,
      hasMessage: !!message,
      createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? null,
      joinedAt: (data.joinedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? null,
    };
  });

  return NextResponse.json({ success: true, revealUnlocked, guests });
}

