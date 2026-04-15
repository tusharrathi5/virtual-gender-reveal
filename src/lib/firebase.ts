import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
 
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "placeholder",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "placeholder",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "placeholder",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "placeholder",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "placeholder",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "placeholder",
};
 
function getFirebaseApp() {
  if (getApps().length) return getApp();
  return initializeApp(firebaseConfig);
}
 
let _authInitialized = false;
 
export function getFirebaseAuth() {
  const auth = getAuth(getFirebaseApp());
  // Set LOCAL persistence once — survives page refresh and navigation
  // Firebase auto-refreshes tokens while active; idle timeout handled server-side
  if (!_authInitialized && typeof window !== "undefined") {
    _authInitialized = true;
    setPersistence(auth, browserLocalPersistence).catch(console.error);
  }
  return auth;
}
export function getFirebaseDb() {
  return getFirestore(getFirebaseApp());
}
 
export function getFirebaseStorage() {
  return getStorage(getFirebaseApp());
}
 
export default getFirebaseApp;
