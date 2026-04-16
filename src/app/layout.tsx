import type { Metadata } from "next";
import "../styles/globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { AuthSyncWrapper } from "@/components/AuthSyncWrapper";

export const metadata: Metadata = {
  title: "Virtual Gender Reveal — Crafted for Moments That Matter",
  description: "Create a cinematic gender reveal and share the moment live with everyone you love, wherever they are.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AuthSyncWrapper>
            {children}
          </AuthSyncWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
