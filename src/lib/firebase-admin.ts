import * as admin from "firebase-admin";
 
// Initialize Firebase Admin SDK once
// Requires FIREBASE_ADMIN_SERVICE_ACCOUNT env var (JSON string from Firebase Console)
// OR individual env vars: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY
 
function getAdminApp() {
  if (admin.apps.length > 0) return admin.app();
 
  const serviceAccount = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
 
  if (serviceAccount) {
    // Option 1: Full JSON string in one env var
    const parsed = JSON.parse(serviceAccount);
    return admin.initializeApp({
      credential: admin.credential.cert(parsed),
    });
  }
 
  // Option 2: Individual env vars
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
 
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin SDK not configured. Set FIREBASE_ADMIN_SERVICE_ACCOUNT or individual FIREBASE_ADMIN_* env vars."
    );
  }
 
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}
 
export function getAdminAuth() {
  return admin.auth(getAdminApp());
}
 
export function getAdminDb() {
  return admin.firestore(getAdminApp());
}
 
export { admin };
