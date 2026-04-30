export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sendPasswordHelpEmail, sendWelcomeEmail } from "@/lib/resendEmail";

type EmailEventBody =
  | { type: "forgot_password"; email: string }
  | { type: "signup"; email: string; fullName: string };

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
      await sendPasswordHelpEmail({ to: body.email.trim().toLowerCase() });
      return NextResponse.json({ success: true });
    }

    if (body.type === "signup") {
      if (!body.email || !isValidEmail(body.email) || !body.fullName?.trim()) {
        return NextResponse.json({ error: "Invalid signup payload." }, { status: 400 });
      }
      await sendWelcomeEmail({
        to: body.email.trim().toLowerCase(),
        fullName: body.fullName.trim(),
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unsupported event type." }, { status: 400 });
  } catch (err) {
    console.error("[email-events] send failed:", err);
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }
}
