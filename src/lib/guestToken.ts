import { v4 as uuidv4 } from "uuid";
import CryptoJS from "crypto-js";

const SECRET = process.env.GUEST_LINK_SECRET || process.env.DOCTOR_LINK_SECRET || "fallback-secret-change-me";

export function generateGuestToken(enquiryId: string, guestId: string): string {
  const payload = {
    enquiryId,
    guestId,
    exp: Date.now() + 5 * 24 * 60 * 60 * 1000,
    nonce: uuidv4(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = CryptoJS.HmacSHA256(encoded, SECRET).toString();
  return `${encoded}.${sig}`;
}

export function parseGuestToken(token: string): { enquiryId: string; guestId: string; exp: number } | null {
  try {
    const [encoded] = token.split(".");
    if (!encoded) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload?.enquiryId || !payload?.guestId || typeof payload?.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
