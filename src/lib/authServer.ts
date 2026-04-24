import { getAdminAuth } from "@/lib/firebase-admin";

/**
 * Verify a Firebase ID token from the Authorization header.
 * Returns { uid, email, emailVerified } on success, or null if invalid/missing.
 *
 * Usage in API routes:
 *   const session = await verifyAuthHeader(request.headers.get("Authorization"));
 *   if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 */
export async function verifyAuthHeader(
  authHeader: string | null
): Promise<{ uid: string; email: string | undefined; emailVerified: boolean } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: !!decoded.email_verified,
    };
  } catch {
    return null;
  }
}
