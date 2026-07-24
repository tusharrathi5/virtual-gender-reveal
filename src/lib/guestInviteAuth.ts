import CryptoJS from "crypto-js";
import type { DocumentReference, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { parseGuestToken } from "@/lib/guestToken";
import {
  isBundleOfJoyAnnouncement,
  PARTY_UNAVAILABLE_MESSAGE,
} from "@/lib/revealAccess";

export type GuestInviteData = {
  enquiryId?: string;
  name?: string;
  tokenHash?: string | null;
  inviteStatus?: string;
  lastChatAt?: Timestamp;
  isHost?: boolean;
};

type GuestInviteAuthSuccess = {
  ok: true;
  token: string;
  enquiryId: string;
  guestId: string;
  guestName: string;
  guestRef: DocumentReference;
  guestData: GuestInviteData;
};

type GuestInviteAuthFailure = {
  ok: false;
  status: number;
  error: string;
};

export type GuestInviteAuthResult = GuestInviteAuthSuccess | GuestInviteAuthFailure;

export function normalizeGuestToken(raw: string) {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export async function verifyGuestInviteToken(raw: string): Promise<GuestInviteAuthResult> {
  const token = normalizeGuestToken(raw);
  const payload = parseGuestToken(token);
  if (!payload) return { ok: false, status: 401, error: "Invalid or expired invite." };

  const guestRef = getAdminDb().collection("guest_invites").doc(payload.guestId);
  const guestSnap = await guestRef.get();
  if (!guestSnap.exists) return { ok: false, status: 404, error: "Invite not found." };

  const guestData = guestSnap.data() as GuestInviteData;
  const tokenHash = typeof guestData.tokenHash === "string" ? guestData.tokenHash : null;
  if (!tokenHash || guestData.inviteStatus === "revoked") {
    return { ok: false, status: 401, error: "Invite is no longer active." };
  }

  const isHost = Boolean(guestData.isHost);
  if (guestData.enquiryId !== payload.enquiryId || (!isHost && tokenHash !== CryptoJS.SHA256(token).toString())) {
    return { ok: false, status: 401, error: "Invalid invite." };
  }

  const enquirySnap = await getAdminDb()
    .collection("enquiries")
    .doc(payload.enquiryId)
    .get();
  if (!enquirySnap.exists) {
    return { ok: false, status: 404, error: "Reveal not found." };
  }
  if (isBundleOfJoyAnnouncement(enquirySnap.data())) {
    return { ok: false, status: 409, error: PARTY_UNAVAILABLE_MESSAGE };
  }

  return {
    ok: true,
    token,
    enquiryId: payload.enquiryId,
    guestId: payload.guestId,
    guestName: guestData.name || "Guest",
    guestRef,
    guestData,
  };
}
