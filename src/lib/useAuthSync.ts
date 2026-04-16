"use client";
 
import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
 
// This hook syncs the auth state to cookies so middleware can read it.
// Call it in your root layout or a top-level component.
export function useAuthSync() {
  const { user, firestoreUser } = useAuth();
 
  useEffect(() => {
    if (user) {
      // Set auth cookies for middleware
      document.cookie = `vgr_auth=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      document.cookie = `vgr_role=${firestoreUser?.role || "user"}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    } else {
      // Clear auth cookies on logout
      document.cookie = "vgr_auth=; path=/; max-age=0";
      document.cookie = "vgr_role=; path=/; max-age=0";
    }
  }, [user, firestoreUser]);
}
