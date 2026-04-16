"use client";

import { useAuthSync } from "@/lib/useAuthSync";

export function AuthSyncWrapper({ children }: { children: React.ReactNode }) {
  useAuthSync();
  return <>{children}</>;
}
