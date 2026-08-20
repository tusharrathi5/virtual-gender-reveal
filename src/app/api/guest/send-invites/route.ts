export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import CryptoJS from "crypto-js";
import { verifyAuthHeader } from "@/lib/authServer";
import { getAdminDb } from "@/lib/firebase-admin";
import { generateGuestToken } from "@/lib/guestToken";
import { sendGuestInviteEmail } from "@/lib/resendEmail";
import { sendInviteSms } from "@/lib/twilioSms";
import {
  isBundleOfJoyAnnouncement,
  PARTY_UNAVAILABLE_MESSAGE,
} from "@/lib/revealAccess";

interface GuestInput {
  name: string;
  phone?: string;
  email: string;
}

interface ExistingInvite {
  guestId: string;
  name?: string;
  phone?: string;
  email?: string;
  isHost?: boolean;
  inviteStatus?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const session = await verifyAuthHeader(req.headers.get("Authorization"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { enquiryId?: string; guests?: GuestInput[] } | null;
  const enquiryId = body?.enquiryId?.trim();
  const guests = body?.guests ?? [];
  if (!enquiryId || !Array.isArray(guests) || guests.length === 0) {
    return NextResponse.json({ error: "enquiryId and guests are required." }, { status: 400 });
  }
  const validatedEnquiryId = enquiryId;

  const enquiryRef = getAdminDb().collection("enquiries").doc(validatedEnquiryId);
  const enquirySnap = await enquiryRef.get();
  if (!enquirySnap.exists) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  const enquiry = enquirySnap.data() as {
    userId: string;
    parentName?: string;
    revealAt?: Timestamp;
    revealTimezone?: string;
    mode?: string;
    plan?: string;
    partyEnabled?: boolean;
  };
  if (enquiry.userId !== session.uid) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (isBundleOfJoyAnnouncement(enquiry)) {
    return NextResponse.json(
      { error: PARTY_UNAVAILABLE_MESSAGE },
      { status: 409 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "";
  if (!appUrl) return NextResponse.json({ error: "Missing app URL." }, { status: 500 });

  const userSnap = await getAdminDb().collection("users").doc(session.uid).get();
  const userData = userSnap.data() as { fullName?: string; phone?: string; email?: string } | undefined;
  const hostEmail = (session.email || userData?.email || "").trim().toLowerCase();
  const hostName = (userData?.fullName || enquiry.parentName || "Host").trim();

  const existingSnap = await getAdminDb()
    .collection("guest_invites")
    .where("enquiryId", "==", validatedEnquiryId)
    .get();
  const existingByEmail = new Map<string, ExistingInvite>();
  const existingInvites = existingSnap.docs.map((doc) => {
    const data = doc.data() as ExistingInvite;
    return { ...data, guestId: doc.id };
  });
  const existingHost = existingInvites.find((invite) => invite.isHost);
  existingInvites.forEach((invite) => {
    const normalizedEmail = invite.email?.trim().toLowerCase();
    if (normalizedEmail && !invite.isHost) existingByEmail.set(normalizedEmail, invite);
  });

  const normalizedGuests = guests
    .map((g) => ({
      name: g?.name?.trim() || "",
      phone: g?.phone?.trim() || "",
      email: g?.email?.trim().toLowerCase() || "",
    }))
    .filter((g) => g.name && EMAIL_RE.test(g.email) && g.email !== hostEmail);

  if (normalizedGuests.length === 0) {
    return NextResponse.json({ error: "At least one guest with a valid name and email is required." }, { status: 400 });
  }

  let sent = 0;
  let resent = 0;
  let failed = 0;
  let created = 0;

  async function writeAndSendInvite(input: {
    guestId?: string;
    name: string;
    phone?: string;
    email: string;
    isHost?: boolean;
  inviteStatus?: string;
  }): Promise<boolean> {
    const guestRef = input.guestId
      ? getAdminDb().collection("guest_invites").doc(input.guestId)
      : getAdminDb().collection("guest_invites").doc();
    const token = generateGuestToken(validatedEnquiryId, guestRef.id);
    const tokenHash = CryptoJS.SHA256(token).toString();

    const payload: Record<string, unknown> = {
      guestId: guestRef.id,
      enquiryId: validatedEnquiryId,
      name: input.name,
      phone: input.phone || "",
      email: input.email,
      isHost: Boolean(input.isHost),
      tokenHash,
      inviteStatus: "sent",
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!input.guestId) {
      payload.prediction = null;
      payload.message = null;
      payload.createdAt = FieldValue.serverTimestamp();
    }

    await guestRef.set(payload, { merge: true });

    const inviteUrl = `${appUrl.replace(/\/$/, "")}/guest/${encodeURIComponent(token)}`;
    const start = enquiry.revealAt?.toDate?.() || new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${enquiry.parentName || "Parents"}'s Virtual Gender Reveal`)}&dates=${fmt(start)}/${fmt(end)}&ctz=${encodeURIComponent(enquiry.revealTimezone || "UTC")}&details=${encodeURIComponent(`Join the reveal: ${inviteUrl}`)}`;
    const icsUrl = `${appUrl.replace(/\/$/, "")}/api/guest/${encodeURIComponent(token)}/calendar.ics`;
    try {
      if (input.phone) {
        try {
          await sendInviteSms({
            toPhone: input.phone,
            guestName: input.name,
            parentName: enquiry.parentName || "the parents",
            inviteUrl,
            revealAtIso: enquiry.revealAt?.toDate?.().toISOString?.() || null,
            revealTimezone: enquiry.revealTimezone || "UTC",
            isHost: Boolean(input.isHost),
          });
        } catch (smsErr) {
          const errMessage = smsErr instanceof Error ? smsErr.message : String(smsErr);
          console.error(`[guest/send-invites] Twilio SMS delivery failed for ${input.name}: ${errMessage}`);
        }
      }

      if (!input.isHost) {
        const emailParams = {
          to: input.email,
          guestName: input.name,
          parentName: enquiry.parentName || "the parents",
          revealAtIso: enquiry.revealAt?.toDate?.().toISOString?.() || new Date().toISOString(),
          revealTimezone: enquiry.revealTimezone || "UTC",
          inviteUrl,
          googleCalendarUrl,
          icsUrl,
        };
        await sendGuestInviteEmail(emailParams);
      }
      return true;
    } catch (err) {
      await guestRef.update({
        inviteStatus: "failed",
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.error(`[guest/send-invites] Failed to send invite to ${input.email}:`, err);
      return false;
    }
  }

  const seenInRequest = new Set<string>();
  for (const g of normalizedGuests) {
    if (seenInRequest.has(g.email)) continue;
    seenInRequest.add(g.email);
    const existingInvite = existingByEmail.get(g.email);
    const ok = await writeAndSendInvite({
      guestId: existingInvite?.guestId,
      name: g.name,
      phone: g.phone,
      email: g.email,
    });
    if (ok) {
      sent += 1;
      if (existingInvite) resent += 1;
      else created += 1;
    } else {
      failed += 1;
    }
  }

  let hostSent = false;
  const hostAlreadySent = existingHost?.inviteStatus === "sent";
  if (sent > 0 && !hostAlreadySent && hostEmail && EMAIL_RE.test(hostEmail)) {
    hostSent = await writeAndSendInvite({
      guestId: existingHost?.guestId || `host-party-${validatedEnquiryId}`,
      name: hostName,
      phone: userData?.phone || "",
      email: hostEmail,
      isHost: true,
    });
  }

  await enquiryRef.update({
    guestCount: FieldValue.increment(created),
    "stages.guestInvitesSent": Timestamp.now(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true, sent, resent, created, failed, hostSent });
}
