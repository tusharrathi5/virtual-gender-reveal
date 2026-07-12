import type { Metadata } from "next";
import "../styles/globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { AuthSyncWrapper } from "@/components/AuthSyncWrapper";

import type { Viewport } from "next";

export const metadata: Metadata = {
  title: "Virtual Gender Reveal — Crafted for Moments That Matter",
  description: "Create a cinematic gender reveal and share the moment live with everyone you love, wherever they are.",
  icons: {
    icon: [
      {
        url: "/Favicon-VGR.png",
        type: "image/png",
      },
    ],
    shortcut: "/Favicon-VGR.png",
    apple: "/Favicon-VGR.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
