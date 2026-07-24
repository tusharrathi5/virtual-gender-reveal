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
