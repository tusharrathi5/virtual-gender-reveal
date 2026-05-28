export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredShadowRecords } from "@/lib/deletedUsers";

// ─── GET /api/cron/purge-deleted-users ──────────────────────

/**
 * Daily cron job — purges shadow records (deleted_users) where purgeAt is in the past.
 *
 * Triggered by Vercel Cron Jobs (configured in vercel.json).
 * Vercel automatically attaches `Authorization: Bearer ${CRON_SECRET}` to scheduled
 * invocations of this route.
 *
 * Manual invocation is possible by anyone who has the CRON_SECRET — keep it secret.
 *
 * Why GET? Vercel Cron Jobs only support GET. POST is for human-initiated work.
 */
export async function GET(req: NextRequest) {
  // 1. Verify the request comes from Vercel Cron (or someone with the secret)
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[cron/purge-deleted-users] CRON_SECRET env var not set");
    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET not set." },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[cron/purge-deleted-users] Unauthorized cron invocation attempt");
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // 2. Run the purge
  try {
    const result = await purgeExpiredShadowRecords();

    if (result.errors.length > 0) {
      console.warn(
        `[cron/purge-deleted-users] Completed with errors:`,
        result
      );
    } else {
      console.log(
        `[cron/purge-deleted-users] Purged ${result.purged}/${result.scanned} shadow records`
      );
    }

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron/purge-deleted-users] Unexpected error:", err);
    const msg = err instanceof Error ? err.message : "Purge failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
