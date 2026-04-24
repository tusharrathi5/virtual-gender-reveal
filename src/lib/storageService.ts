import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase";
import { PHOTO_MIN, PHOTO_MAX } from "@/lib/types";

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

/**
 * Validate an array of files for photo upload (must be 1-3 valid images).
 */
export function validatePhotoFiles(files: File[]): ValidationResult {
  if (!Array.isArray(files) || files.length < PHOTO_MIN) {
    return {
      ok: false,
      error: `Please upload at least ${PHOTO_MIN} photo.`,
    };
  }
  if (files.length > PHOTO_MAX) {
    return {
      ok: false,
      error: `You can upload a maximum of ${PHOTO_MAX} photos.`,
    };
  }
  for (let i = 0; i < files.length; i++) {
    const result = validateImageFile(files[i]);
    if (!result.ok) {
      return {
        ok: false,
        error: `Photo ${i + 1}: ${result.error}`,
      };
    }
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

/**
 * Build the Storage path for a photo at a given index.
 * Matches the pattern enforced by storage.rules: enquiries/{enquiryId}/photos/{filename}
 */
function getPhotoPath(enquiryId: string, index: number, ext: string): string {
  return `enquiries/${enquiryId}/photos/photo-${index}.${ext}`;
}

// ─── Upload Functions ───────────────────────────────────────

/**
 * Upload a single photo for an enquiry at a specific index (0, 1, or 2).
 * Overwrites any existing photo at that index.
 * Returns the public download URL.
 */
export async function uploadPhoto(
  enquiryId: string,
  file: File,
  index: number
): Promise<string> {
  if (index < 0 || index >= PHOTO_MAX) {
    throw new Error(
      `Photo index must be between 0 and ${PHOTO_MAX - 1}, got ${index}.`
    );
  }

  const validation = validateImageFile(file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const ext = getExtension(file);
  const path = getPhotoPath(enquiryId, index, ext);

  const storage = getFirebaseStorage();
  const ref = storageRef(storage, path);

  await uploadBytes(ref, file, {
    contentType: file.type,
    customMetadata: {
      enquiryId,
      photoIndex: String(index),
    },
  });

  return await getDownloadURL(ref);
}

/**
 * Upload multiple photos (1 to 3) in parallel.
 * Returns an array of download URLs in the same order as the input files.
 * If any upload fails, the whole operation rejects — callers should handle cleanup.
 */
export async function uploadPhotos(
  enquiryId: string,
  files: File[]
): Promise<string[]> {
  const validation = validatePhotoFiles(files);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  // Upload all files in parallel, preserving order
  const uploadPromises = files.map((file, i) => uploadPhoto(enquiryId, file, i));
  return await Promise.all(uploadPromises);
}

// ─── Delete Functions ───────────────────────────────────────

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

/**
 * Delete all photos for an enquiry by listing and deleting the folder contents.
 * Used when an enquiry is fully deleted.
 * Silently succeeds if no photos exist.
 */
export async function deleteAllPhotos(enquiryId: string): Promise<void> {
  try {
    const storage = getFirebaseStorage();
    const folderRef = storageRef(storage, `enquiries/${enquiryId}/photos`);
    const listing = await listAll(folderRef);

    // Delete every file found, in parallel
    await Promise.all(
      listing.items.map(async (item) => {
        try {
          await deleteObject(item);
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code === "storage/object-not-found") return;
          throw err;
        }
      })
    );
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "storage/object-not-found") {
      // Folder doesn't exist — nothing to delete
      return;
    }
    throw err;
  }
}
