export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sendPasswordResetLinkEmail } from "@/lib/resendEmail";
import { getAdminAuth } from "@/lib/firebase-admin";

type EmailEventBody =
  | { type: "forgot_password"; email: string };

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function POST(req: NextRequest) {
  const body: EmailEventBody | null = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !("type" in body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    if (body.type === "forgot_password") {
      if (!body.email || !isValidEmail(body.email)) {
        return NextResponse.json({ error: "Invalid email." }, { status: 400 });
      }
      const email = body.email.trim().toLowerCase();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "";
      if (!appUrl) {
        return NextResponse.json({ error: "Missing app URL for reset link generation." }, { status: 500 });
      }

      const resetUrl = await getAdminAuth().generatePasswordResetLink(email, {
        url: `${appUrl.replace(/\/$/, "")}/login?reset=1`,
        handleCodeInApp: false,
      });

      await sendPasswordResetLinkEmail({ to: email, resetUrl });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unsupported event type." }, { status: 400 });
  } catch (err) {
    console.error("[email-events] send failed:", err);
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }
}
