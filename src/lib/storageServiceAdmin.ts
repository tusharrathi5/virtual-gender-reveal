import { admin } from "@/lib/firebase-admin";

/**
 * Server-only helper (Firebase Admin SDK) for deleting Storage files.
 * Use this from API routes and server-side code ONLY.
 * For client-side photo operations, use storageService.ts instead.
 *
 * Uses the default storage bucket configured in the Firebase Admin SDK.
 * Falls back to NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET if no default is set.
 */

function getBucket() {
  // If Admin SDK wasn't initialized with a bucket, pass the bucket name explicitly
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (bucketName) {
    return admin.storage().bucket(bucketName);
  }
  return admin.storage().bucket();
}

export interface DeletePhotosResult {
  deleted: number;
  failed: number;
  errors: string[];
}

/**
 * Delete every file under enquiries/{enquiryId}/photos/ in Storage.
 * Does not throw on individual file failures — collects errors and returns a summary.
 * Callers should check the result and log any errors for manual cleanup.
 */
export async function deleteEnquiryPhotosAdmin(
  enquiryId: string
): Promise<DeletePhotosResult> {
  const result: DeletePhotosResult = { deleted: 0, failed: 0, errors: [] };

  try {
    const bucket = getBucket();
    const prefix = `enquiries/${enquiryId}/photos/`;
    const [files] = await bucket.getFiles({ prefix });

    if (files.length === 0) {
      return result;
    }

    // Delete each file individually so one failure doesn't stop others
    await Promise.all(
      files.map(async (file) => {
        try {
          await file.delete();
          result.deleted++;
        } catch (err) {
          result.failed++;
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Failed to delete ${file.name}: ${msg}`);
        }
      })
    );
  } catch (err) {
    // Listing itself failed — record and return, don't throw
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Failed to list photos for enquiry ${enquiryId}: ${msg}`);
  }

  return result;
}
