import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type {
  GenderValue,
  GenderSubmittedBy,
  SecureGender,
} from "@/lib/types";

// ─── Constants ──────────────────────────────────────────────

const COLLECTION = "secure-genders";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard IV length

// ─── Key Management ─────────────────────────────────────────

/**
 * Load the encryption key for a given version from env vars.
 * Throws if the key is missing or wrong length.
 */
function getKey(version: number): Buffer {
  const envName = `GENDER_ENCRYPTION_KEY_V${version}`;
  const keyBase64 = process.env[envName];

  if (!keyBase64) {
    throw new Error(
      `Missing env var ${envName}. Cannot encrypt/decrypt gender data.`
    );
  }

  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error(
      `${envName} must decode to exactly 32 bytes (256 bits). Got ${key.length} bytes.`
    );
  }

  return key;
}

/**
 * Returns the key version to use for *new* encryptions.
 * Older encryptions keep using whichever version they were created with.
 */
function getCurrentKeyVersion(): number {
  const raw = process.env.GENDER_ENCRYPTION_CURRENT_VERSION;
  if (!raw) {
    throw new Error(
      "Missing env var GENDER_ENCRYPTION_CURRENT_VERSION. Must be a positive integer."
    );
  }
  const version = parseInt(raw, 10);
  if (isNaN(version) || version < 1) {
    throw new Error(
      `GENDER_ENCRYPTION_CURRENT_VERSION must be a positive integer, got "${raw}".`
    );
  }
  return version;
}

// ─── Encryption / Decryption (pure functions) ───────────────

interface EncryptedPayload {
  encryptedGender: string; // base64 ciphertext
  iv: string; // base64 IV
  authTag: string; // base64 GCM auth tag
  keyVersion: number;
}

/**
 * Encrypt a gender value using the current key version.
 * Returns everything needed to decrypt later.
 */
export function encryptGenderValue(gender: GenderValue): EncryptedPayload {
  if (gender !== "boy" && gender !== "girl") {
    throw new Error(`Invalid gender value: "${gender}". Must be "boy" or "girl".`);
  }

  const keyVersion = getCurrentKeyVersion();
  const key = getKey(keyVersion);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(gender, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedGender: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion,
  };
}

/**
 * Decrypt a payload back to the original gender value.
 * Uses whichever key version was used to encrypt it.
 */
export function decryptGenderValue(payload: {
  encryptedGender: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}): GenderValue {
  const key = getKey(payload.keyVersion);
  const iv = Buffer.from(payload.iv, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");
  const ciphertext = Buffer.from(payload.encryptedGender, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  const value = decrypted.toString("utf8");
  if (value !== "boy" && value !== "girl") {
    throw new Error(
      "Decryption succeeded but result is not a valid gender value. Data corruption?"
    );
  }
  return value;
}

// ─── Firestore Operations ───────────────────────────────────

/**
 * Save an encrypted gender to Firestore.
 * Document ID = enquiryId (1:1 mapping with enquiries).
 * Overwrites any existing record.
 */
export async function saveGender(params: {
  enquiryId: string;
  gender: GenderValue;
  submittedBy: GenderSubmittedBy;
  submittedByUid: string | null;
}): Promise<void> {
  const { enquiryId, gender, submittedBy, submittedByUid } = params;

  const payload = encryptGenderValue(gender);

  const db = getAdminDb();
  const ref = db.collection(COLLECTION).doc(enquiryId);

  const existing = await ref.get();

  if (existing.exists) {
    // Update — keep original createdAt
    await ref.update({
      enquiryId,
      ...payload,
      submittedBy,
      submittedByUid,
      submittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    // Create
    await ref.set({
      enquiryId,
      ...payload,
      submittedBy,
      submittedByUid,
      submittedAt: FieldValue.serverTimestamp(),
      revealedToGuestsAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

/**
 * Get the raw secure-gender document (still encrypted).
 * Useful when you only need metadata (who submitted, when) without decrypting.
 */
export async function getSecureGenderDoc(
  enquiryId: string
): Promise<SecureGender | null> {
  const db = getAdminDb();
  const snap = await db.collection(COLLECTION).doc(enquiryId).get();
  if (!snap.exists) return null;
  return snap.data() as SecureGender;
}

/**
 * Get the decrypted gender value for an enquiry.
 * Returns null if no gender has been submitted yet.
 * This is the only function that ever returns a plaintext gender.
 */
export async function getDecryptedGender(
  enquiryId: string
): Promise<GenderValue | null> {
  const doc = await getSecureGenderDoc(enquiryId);
  if (!doc) return null;
  return decryptGenderValue({
    encryptedGender: doc.encryptedGender,
    iv: doc.iv,
    authTag: doc.authTag,
    keyVersion: doc.keyVersion,
  });
}

/**
 * Mark that the gender has been revealed to guests.
 * Called when the reveal event plays.
 */
export async function markGenderRevealed(enquiryId: string): Promise<void> {
  const db = getAdminDb();
  await db.collection(COLLECTION).doc(enquiryId).update({
    revealedToGuestsAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Hard delete the secure-gender record for an enquiry.
 * Used when an enquiry is deleted entirely.
 */
export async function deleteSecureGender(enquiryId: string): Promise<void> {
  const db = getAdminDb();
  await db.collection(COLLECTION).doc(enquiryId).delete();
}
