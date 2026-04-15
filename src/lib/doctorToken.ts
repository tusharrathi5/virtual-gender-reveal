import { v4 as uuidv4 } from "uuid";
import CryptoJS from "crypto-js";

const SECRET = process.env.DOCTOR_LINK_SECRET || "fallback-secret-change-me";

/**
 * Generate a signed, one-time doctor token.
 * Encodes: enquiryId + expiry + nonce — signed with HMAC-SHA256.
 */
export function generateDoctorToken(enquiryId: string): string {
  const payload = {
    enquiryId,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    nonce: uuidv4(),
  };
  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data).toString("base64url");
  const sig = CryptoJS.HmacSHA256(encoded, SECRET).toString();
  return `${encoded}.${sig}`;
}

/**
 * Validate a doctor token. Returns decoded payload or null.
 */
export function validateDoctorToken(
  token: string
): { enquiryId: string; exp: number; nonce: string } | null {
  try {
    const [encoded, sig] = token.split(".");
    if (!encoded || !sig) return null;

    const expectedSig = CryptoJS.HmacSHA256(encoded, SECRET).toString();
    if (sig !== expectedSig) return null; // tampered

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (Date.now() > payload.exp) return null; // expired

    return payload;
  } catch {
    return null;
  }
}

/**
 * Encrypt the gender result before storing in Firestore.
 */
export function encryptGender(gender: "boy" | "girl"): string {
  return CryptoJS.AES.encrypt(gender, SECRET).toString();
}

/**
 * Decrypt gender — only called by Admin.
 */
export function decryptGender(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
}
