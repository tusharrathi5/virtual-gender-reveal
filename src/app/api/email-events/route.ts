export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { sendPasswordResetLinkEmail } from "@/lib/resendEmail";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

type EmailEventBody =
  | { type: "forgot_password"; email: string };

const FORGOT_PASSWORD_EMAIL_DAILY_LIMIT = 3;
const FORGOT_PASSWORD_IP_HOURLY_LIMIT = 10;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip")?.trim() || "unknown";
}

async function consumeForgotPasswordLimit(req: NextRequest, email: string): Promise<boolean> {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const hour = now.toISOString().slice(0, 13);
  const ip = getClientIp(req);
  const db = getAdminDb();
  const scopes = [
    {
      ref: db.collection("email_event_limits").doc(`forgot_password_email_${day}_${hashKey(email)}`),
      limit: FORGOT_PASSWORD_EMAIL_DAILY_LIMIT,
      scope: "email",
      window: day,
    },
    {
      ref: db.collection("email_event_limits").doc(`forgot_password_ip_${hour}_${hashKey(ip)}`),
      limit: FORGOT_PASSWORD_IP_HOURLY_LIMIT,
      scope: "ip",
      window: hour,
    },
  ];

  return db.runTransaction(async (tx) => {
    const snaps = await Promise.all(scopes.map((scope) => tx.get(scope.ref)));

    for (let i = 0; i < scopes.length; i += 1) {
      const count = snaps[i].exists ? ((snaps[i].data()?.count as number) ?? 0) : 0;
      if (count >= scopes[i].limit) return false;
    }

    scopes.forEach((scope, i) => {
      const count = snaps[i].exists ? ((snaps[i].data()?.count as number) ?? 0) : 0;
      tx.set(scope.ref, {
        type: "forgot_password",
        scope: scope.scope,
        window: scope.window,
        count: count + 1,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: snaps[i].exists ? snaps[i].data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    return true;
  });
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
      const allowed = await consumeForgotPasswordLimit(req, email);
      if (!allowed) {
        return NextResponse.json({ error: "Too many password reset requests. Please try again later." }, { status: 429 });
      }

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
