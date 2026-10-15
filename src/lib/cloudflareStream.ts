type CloudflareDownload = {
  status?: string;
  url?: string;
};

type CloudflareDownloadResponse = {
  success?: boolean;
  result?: {
    default?: CloudflareDownload;
    status?: string;
    url?: string;
  };
  errors?: Array<{ message?: string }>;
};

export type StreamMp4Download = {
  ready: boolean;
  status: string;
  url: string | null;
};

function getCloudflareConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_STREAM_TOKEN?.trim();
  if (!accountId || !apiToken) {
    throw new Error("Cloudflare Stream is not configured.");
  }
  return { accountId, apiToken };
}

function normalizeCustomerSubdomain(value: string): string {
  return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function buildStreamWatchUrl(streamUid: string): string {
  const customerSubdomain =
    process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim();
  return customerSubdomain
    ? `https://${normalizeCustomerSubdomain(customerSubdomain)}/${streamUid}/watch`
    : `https://iframe.videodelivery.net/${streamUid}`;
}

/**
 * Basic-plan reveals and announcements store a shared Firebase Storage .mov as their
 * videoUrl. Browsers can't reliably play that inline, so the same clips are mirrored on
 * Cloudflare Stream; this maps such a URL to its Stream uid (null if not mirrored).
 */
export function getStaticRevealStreamUid(videoUrl: string): string | null {
  const match = videoUrl.match(/static(?:%2F|\/)videos(?:%2F|\/)(boy|girl)_reveal\.mov/i);
  if (!match) return null;
  const uid =
    match[1].toLowerCase() === "boy"
      ? process.env.CLOUDFLARE_STATIC_BOY_REVEAL_UID
      : process.env.CLOUDFLARE_STATIC_GIRL_REVEAL_UID;
  return uid?.trim() || null;
}

/**
 * Starts Cloudflare's MP4 generation and returns the stable download URL.
 * Cloudflare makes this URL downloadable as soon as the MP4 finishes encoding.
 */
export async function enableStreamMp4Download(
  streamUid: string
): Promise<string> {
  const { accountId, apiToken } = getCloudflareConfig();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${streamUid}/downloads/default`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}` },
    }
  );
  const data = (await response.json().catch(() => ({}))) as CloudflareDownloadResponse;

  if (!response.ok || data.success === false) {
    throw new Error(
      data.errors?.[0]?.message || "Failed to prepare the downloadable video."
    );
  }

  const apiUrl = data.result?.default?.url || data.result?.url;
  if (apiUrl) return apiUrl;

  const customerSubdomain =
    process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim();
  if (!customerSubdomain) {
    throw new Error("Cloudflare download URL is unavailable.");
  }
  return `https://${normalizeCustomerSubdomain(
    customerSubdomain
  )}/${streamUid}/downloads/default.mp4`;
}

/**
 * Checks whether Cloudflare has finished generating the downloadable MP4.
 * A Stream video can be ready to watch before its MP4 download is ready.
 */
export async function getStreamMp4Download(
  streamUid: string
): Promise<StreamMp4Download> {
  const { accountId, apiToken } = getCloudflareConfig();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${streamUid}/downloads`,
    {
      headers: { Authorization: `Bearer ${apiToken}` },
      cache: "no-store",
    }
  );
  const data = (await response.json().catch(() => ({}))) as CloudflareDownloadResponse;

  if (!response.ok || data.success === false) {
    throw new Error(
      data.errors?.[0]?.message || "Unable to check the downloadable video."
    );
  }

  const download = data.result?.default;
  const status = download?.status?.toLowerCase() || "unknown";
  const customerSubdomain =
    process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim();
  const fallbackUrl = customerSubdomain
    ? `https://${normalizeCustomerSubdomain(
        customerSubdomain
      )}/${streamUid}/downloads/default.mp4`
    : null;

  return {
    ready: status === "ready",
    status,
    url: download?.url || (status === "ready" ? fallbackUrl : null),
  };
}

export async function isStreamReady(streamUid: string): Promise<boolean> {
  const { accountId, apiToken } = getCloudflareConfig();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${streamUid}`,
    { headers: { Authorization: `Bearer ${apiToken}` } }
  );
  const data = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    result?: { readyToStream?: boolean; status?: { state?: string } };
  };
  if (!response.ok || data.success === false) {
    throw new Error("Unable to confirm Cloudflare video status.");
  }
  return (
    data.result?.readyToStream === true ||
    data.result?.status?.state === "ready"
  );
}

/**
 * Fetches a ready video's duration in seconds from Cloudflare Stream.
 * Returns null if the duration isn't available yet (e.g. still processing) or the lookup fails.
 */
export async function getStreamDuration(streamUid: string): Promise<number | null> {
  const { accountId, apiToken } = getCloudflareConfig();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${streamUid}`,
    { headers: { Authorization: `Bearer ${apiToken}` } }
  );
  const data = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    result?: { duration?: number };
  };
  if (!response.ok || data.success === false) return null;
  const duration = data.result?.duration;
  return typeof duration === "number" && duration > 0 ? duration : null;
}
