import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase";

// ─── Constants ──────────────────────────────────────────────

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

// ─── Validation ─────────────────────────────────────────────

export interface ValidationError {
  ok: false;
  error: string;
}

export interface ValidationSuccess {
  ok: true;
}

export type ValidationResult = ValidationError | ValidationSuccess;

/**
 * Check a File before uploading. Returns { ok: true } or { ok: false, error }.
 */
export function validateImageFile(file: File): ValidationResult {
  if (!file) {
    return { ok: false, error: "No file selected." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(2);
    return {
      ok: false,
      error: `File too large (${mb} MB). Maximum size is 5 MB.`,
    };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return {
      ok: false,
      error: `File type "${file.type || "unknown"}" is not supported. Please upload a JPG, PNG, WEBP, GIF, or HEIC image.`,
    };
  }
  return { ok: true };
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Derive file extension from a File's MIME type.
 * Falls back to the file name's extension if MIME isn't recognized.
 */
function getExtension(file: File): string {
  const mimeMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  if (mimeMap[file.type]) return mimeMap[file.type];

  const nameParts = file.name.split(".");
  const fromName = nameParts.length > 1 ? nameParts[nameParts.length - 1].toLowerCase() : "";
  return fromName || "bin";
}

// ─── Upload Functions ───────────────────────────────────────

/**
 * Upload the baby photo for an enquiry.
 * Overwrites any existing baby photo for the same enquiry.
 * Returns the public download URL.
 */
export async function uploadBabyPhoto(
  enquiryId: string,
  file: File
): Promise<string> {
  const validation = validateImageFile(file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const ext = getExtension(file);
  const path = `enquiries/${enquiryId}/baby-photo.${ext}`;

  const storage = getFirebaseStorage();
  const ref = storageRef(storage, path);

  await uploadBytes(ref, file, {
    contentType: file.type,
    customMetadata: {
      enquiryId,
      kind: "baby-photo",
    },
  });

  return await getDownloadURL(ref);
}

/**
 * Upload the sonogram photo for an enquiry.
 * Overwrites any existing sonogram for the same enquiry.
 * Returns the public download URL.
 */
export async function uploadSonogram(
  enquiryId: string,
  file: File
): Promise<string> {
  const validation = validateImageFile(file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const ext = getExtension(file);
  const path = `enquiries/${enquiryId}/sonogram.${ext}`;

  const storage = getFirebaseStorage();
  const ref = storageRef(storage, path);

  await uploadBytes(ref, file, {
    contentType: file.type,
    customMetadata: {
      enquiryId,
      kind: "sonogram",
    },
  });

  return await getDownloadURL(ref);
}

/**
 * Delete a single uploaded file by its full Storage URL.
 * Silently succeeds if the file doesn't exist.
 */
export async function deleteUploadedFile(downloadUrl: string): Promise<void> {
  try {
    const storage = getFirebaseStorage();
    // Firebase Storage SDK accepts download URLs via `ref(storage, url)` when the URL is from getDownloadURL
    const ref = storageRef(storage, downloadUrl);
    await deleteObject(ref);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "storage/object-not-found") {
      // Already deleted — ignore
      return;
    }
    throw err;
  }
}
