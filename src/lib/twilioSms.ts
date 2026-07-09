import twilio from "twilio";

// Initialize credentials from environment
const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
const fromPhone = process.env.TWILIO_PHONE_NUMBER?.trim();

// Lazily initialize Twilio client to prevent crashes if environment variables are missing during build/boot
let client: ReturnType<typeof twilio> | null = null;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
}

interface SendSmsParams {
  toPhone: string;
  guestName: string;
  parentName: string;
  inviteUrl: string;
  revealAtIso?: string | null;
  revealTimezone?: string;
  isHost?: boolean;
}

/**
 * Formats a phone number into international E.164 format.
 * Defaults to country code +1 (US/Canada) if no country code is present.
 */
export function formatToE164(phone: string): string {
  // Remove all non-digits, except + if present at the start
  let cleaned = phone.replace(/[^\d+]/g, "").trim();
  if (!cleaned.startsWith("+")) {
    cleaned = `+1${cleaned}`;
  }
  return cleaned;
}

/**
 * Formats an ISO date string into a friendly, short readable format for SMS.
 */
function formatSmsDate(isoString: string | null, timezone?: string): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone || "UTC",
      timeZoneName: "short",
    });
  } catch {
    return "";
  }
}

/**
 * Sends a text invitation using Twilio.
 * Returns true if sent successfully, false otherwise.
 */
export async function sendInviteSms({
  toPhone,
  guestName,
  parentName,
  inviteUrl,
  revealAtIso = null,
  revealTimezone = "UTC",
  isHost = false,
}: SendSmsParams): Promise<boolean> {
  if (!client || !fromPhone) {
    console.warn("[Twilio SMS] Credentials or sender phone number not configured. Skipping SMS dispatch.");
    return false;
  }

  const formattedTo = formatToE164(toPhone);

  // Validate format basic check (E.164 requires + at the start, followed by digits)
  if (!/^\+\d{10,15}$/.test(formattedTo)) {
    console.warn(`[Twilio SMS] Target phone number "${toPhone}" formatted to "${formattedTo}" is invalid. Skipping SMS dispatch.`);
    return false;
  }

  let body = "";
  if (isHost) {
    body = `Hi ${guestName}! Your Surprise Reveal party has been scheduled. Keep your private host dashboard link safe: ${inviteUrl}`;
  } else {
    const timeInfo = revealAtIso ? `on ${formatSmsDate(revealAtIso, revealTimezone)} ` : "";
    body = `Hi ${guestName}! ${parentName} has invited you to their Surprise Reveal! ${timeInfo}Join the live race & predict here: ${inviteUrl}`;
  }

  try {
    await client.messages.create({
      body,
      from: fromPhone,
      to: formattedTo,
    });
    return true;
  } catch (error) {
    // Log the error safely without exposing raw tokens or API keys
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Twilio SMS] Failed to dispatch SMS to ${formattedTo}. Error Details: ${errMessage}`);
    return false;
  }
}
