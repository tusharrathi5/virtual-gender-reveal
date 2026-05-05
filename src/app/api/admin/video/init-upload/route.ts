export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader } from "@/lib/authServer";
import { getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const session = await verifyAuthHeader(req.headers.get("Authorization"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userSnap = await getAdminDb().collection("users").doc(session.uid).get();
  const role = (userSnap.data()?.role as string | undefined)?.toLowerCase();
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { enquiryId } = (await req.json().catch(() => ({}))) as { enquiryId?: string };
  if (!enquiryId?.trim()) return NextResponse.json({ error: "enquiryId is required." }, { status: 400 });

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_STREAM_TOKEN?.trim();
  if (!accountId || !apiToken) return NextResponse.json({ error: "Cloudflare env vars missing." }, { status: 500 });

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      maxDurationSeconds: 3600,
      meta: { enquiryId },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    return NextResponse.json({ error: "Failed to initialize upload.", details: data }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    uploadURL: data.result?.uploadURL || null,
    uid: data.result?.uid || null,
  });
}

