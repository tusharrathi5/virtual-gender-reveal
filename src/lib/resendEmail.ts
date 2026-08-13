interface BaseEmailParams {
  to: string;
  subject: string;
  html: string;
}

interface ResolvedConfig {
  apiKey: string;
  from: string;
  testMode: boolean;
  testRecipient: string | null;
}

export interface SendDoctorInviteParams {
  to: string;
  parentName: string;
  relationLabel: string;
  revealUrl: string;
  enquiryId: string;
  revealerName?: string;
}

export interface SendParentGenderAlertEmailParams {
  to: string;
  parentName: string;
  revealerRelation: string;
  dashboardUrl: string;
}

export interface SendWelcomeEmailParams {
  to: string;
  fullName: string;
}

export interface SendPasswordHelpEmailParams {
  to: string;
}

export interface SendPasswordResetLinkEmailParams {
  to: string;
  resetUrl: string;
}

export interface SendGuestInviteEmailParams {
  to: string;
  guestName: string;
  parentName: string;
  revealAtIso: string;
  revealTimezone: string;
  inviteUrl: string;
  googleCalendarUrl?: string;
  icsUrl?: string;
}

export interface SendHostInvitationConfirmationEmailParams extends SendGuestInviteEmailParams {}

export interface SendGuestDigestEmailParams {
  to: string;
  parentName: string;
  revealDateLabel: string;
  responses: Array<{ name: string; prediction: string; message: string | null }>;
}
export interface SendGuestReminderEmailParams {
  to: string;
  guestName: string;
  parentName: string;
  revealAtIso: string;
  revealTimezone: string;
  inviteUrl: string;
}
export interface SendRevealReminderEmailParams extends Omit<SendGuestReminderEmailParams, "inviteUrl"> {
  inviteUrl?: string;
  reminderWindow?: "7d" | "24h";
}


// Bump this whenever a static email image (banner/logo) is replaced so
// email clients that cache images by URL (e.g. Gmail's image proxy) and
// CDN/browser caches are forced to fetch the new file instead of serving
// a stale cached copy of the old one.
const EMAIL_ASSET_VERSION = "2";

function isTrue(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveResendConfig(): ResolvedConfig {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const domain = process.env.RESEND_DOMAIN?.trim();

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    process.env.EMAIL_FROM_ADDRESS?.trim() ||
    (domain ? `no-reply@${domain}` : "");

  const testMode = isTrue(process.env.EMAIL_TEST_MODE);
  const testRecipient = process.env.EMAIL_TEST_RECIPIENT?.trim() || process.env.EMAIL_FROM_ADDRESS?.trim() || null;

  if (!apiKey) throw new Error("RESEND_NOT_CONFIGURED: missing RESEND_API_KEY");
  if (!from) {
    throw new Error(
      "RESEND_NOT_CONFIGURED: missing sender. Set RESEND_FROM_EMAIL (or RESEND_FROM / EMAIL_FROM / EMAIL_FROM_ADDRESS) or RESEND_DOMAIN"
    );
  }

  return { apiKey, from, testMode, testRecipient };
}

async function sendEmail({ to, subject, html }: BaseEmailParams): Promise<void> {
  const { apiKey, from, testMode, testRecipient } = resolveResendConfig();
  const recipient = testMode && testRecipient ? testRecipient : to;
  const finalSubject = testMode ? `[TEST MODE] ${subject}` : subject;

  if (testMode) {
    console.warn(`[resendEmail] EMAIL_TEST_MODE enabled. Redirecting email intended for ${to} to ${recipient}.`);
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: finalSubject,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RESEND_SEND_FAILED: ${response.status} ${text}`);
  }
}

export async function sendDoctorInviteEmail(params: SendDoctorInviteParams): Promise<void> {
  const parentName = escapeHtml(params.parentName);
  const relationLabel = escapeHtml(params.relationLabel);
  const revealUrl = escapeHtml(params.revealUrl);
  const revealerName = params.revealerName ? escapeHtml(params.revealerName) : "there";

  const baseUrl = new URL(params.revealUrl).origin;
  const logoUrl = `${baseUrl}/Favicon-VGR.png?v=${EMAIL_ASSET_VERSION}`;
  const bannerUrl = `${baseUrl}/images/image-for-email.png?v=${EMAIL_ASSET_VERSION}`;

  const html = buildVgrEmailTemplateHtml({
    logoUrl,
    bannerUrl,
    badgeText: "Secure Gender Submission",
    headingHtml: `<span style="color: #E8449A;">Secure</span> <span style="color: #3A9FE8;">Gender Link</span>`,
    greetingText: `Hi ${revealerName},`,
    messageHtml: `<p style="margin: 0 0 12px 0;"><strong>${parentName}</strong> has invited you as their <strong>${relationLabel}</strong> to securely submit their baby's gender for their upcoming virtual reveal party.</p>
                  <p style="margin: 0 0 12px 0;">Please click the button below to access the secure, encrypted submission portal. The parents will not be notified of the gender, preserving the surprise!</p>
                  <p style="margin: 0; color: #ef4444; font-size: 13px; font-weight: 600;">⚠️ This secure link expires in 7 days.</p>`,
    revealDateLabel: "Gender Submission Portal",
    revealTimeLabel: "Click below to submit",
    revealTimezone: "Secure connection",
    primaryCtaUrl: revealUrl,
    primaryCtaText: "SUBMIT THE GENDER",
  });

  await sendEmail({
    to: params.to,
    subject: `Secure Gender Submission for ${params.parentName}`,
    html,
  });
}

export async function sendParentGenderAlertEmail(params: SendParentGenderAlertEmailParams): Promise<void> {
  const parentName = escapeHtml(params.parentName);
  const relationLabel = escapeHtml(params.revealerRelation);
  const dashboardUrl = escapeHtml(params.dashboardUrl);

  const baseUrl = new URL(params.dashboardUrl).origin;
  const logoUrl = `${baseUrl}/Favicon-VGR.png?v=${EMAIL_ASSET_VERSION}`;
  const bannerUrl = `${baseUrl}/images/image-for-email.png?v=${EMAIL_ASSET_VERSION}`;

  const html = buildVgrEmailTemplateHtml({
    logoUrl,
    bannerUrl,
    badgeText: "Gender Submitted",
    headingHtml: `<span style="color: #E8449A;">Ready</span> <span style="color: #3A9FE8;">to Reveal!</span> ✦`,
    greetingText: `Hi ${parentName},`,
    messageHtml: `<p style="margin: 0 0 12px 0;">Great news! Your <strong>${relationLabel}</strong> has successfully submitted your baby's gender. Everything is locked in and ready for your big reveal event!</p>
                  <p style="margin: 0;">You can view the countdown, invite guests, and manage your broadcast link directly from your dashboard.</p>`,
    revealDateLabel: "Gender Locked & Encrypted",
    revealTimeLabel: "Ready for broadcast",
    revealTimezone: "Surprise preserved",
    primaryCtaUrl: dashboardUrl,
    primaryCtaText: "GO TO DASHBOARD",
  });

  await sendEmail({
    to: params.to,
    subject: "Your revealer has submitted the baby's gender!",
    html,
  });
}

export async function sendWelcomeEmail(params: SendWelcomeEmailParams): Promise<void> {
  const name = escapeHtml(params.fullName || "there");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Welcome to Virtual Gender Reveal ðŸŽ‰</h2>
      <p>Hi ${name}, your account is ready.</p>
      <p>Please verify your email from the Firebase verification message we just sent so you can fully secure your account.</p>
      <p>Once verified, you can create your first reveal from your dashboard.</p>
    </div>
  `;

  await sendEmail({ to: params.to, subject: "Welcome to Virtual Gender Reveal", html });
}

export async function sendPasswordHelpEmail(params: SendPasswordHelpEmailParams): Promise<void> {
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Password reset requested</h2>
      <p>We just sent your password reset link through Firebase Authentication.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  await sendEmail({ to: params.to, subject: "Your password reset request", html });
}


export async function sendPasswordResetLinkEmail(params: SendPasswordResetLinkEmailParams): Promise<void> {
  const url = escapeHtml(params.resetUrl);
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Reset your password</h2>
      <p>Use the secure link below to reset your password:</p>
      <p><a href="${url}">Reset Password</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  await sendEmail({ to: params.to, subject: "Reset your Virtual Gender Reveal password", html });
}


interface VgrEmailTemplateProps {
  logoUrl: string;
  bannerUrl: string;
  badgeText: string;
  headingHtml: string;
  greetingText: string;
  messageHtml: string;
  revealDateLabel?: string;
  revealTimeLabel?: string;
  revealTimezone?: string;
  primaryCtaUrl: string;
  primaryCtaText: string;
  detailEyebrow?: string;
  detailIcon?: string;
  googleCalendarUrl?: string | null;
  icsUrl?: string | null;
  troubleshootingNote?: string;
}

function buildVgrEmailTemplateHtml(props: VgrEmailTemplateProps): string {
  const {
    logoUrl,
    bannerUrl,
    badgeText,
    headingHtml,
    greetingText,
    messageHtml,
    revealDateLabel = "Keepsake Video",
    revealTimeLabel = "Ready to download",
    revealTimezone = "Secure download",
    primaryCtaUrl,
    primaryCtaText,
    detailEyebrow = "Scheduled Event",
    detailIcon = "📅",
    googleCalendarUrl,
    icsUrl,
    troubleshootingNote = "Having trouble opening the invite? Contact the host for a fresh link.",
  } = props;

  const showCalendar = googleCalendarUrl || icsUrl;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${badgeText} - Virtual Gender Reveal</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-text-size-adjust: none; -ms-text-size-adjust: none;">
  <!-- Outer Wrapper Table -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #fbcfe8 0%, #d6eafe 100%); background-color: #f3f4f6; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Table -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 24px; border: 1px solid #e2e8f0; box-shadow: 0 12px 36px rgba(0,0,0,0.06); overflow: hidden; width: 100%; max-width: 600px; text-align: left;">
          <!-- Card Header Image Banner -->
          <tr>
            <td align="center" style="padding: 0; margin: 0; line-height: 0;">
              <img src="${bannerUrl}" alt="Virtual Gender Reveal" width="600" style="display: block; width: 100%; max-width: 600px; height: auto; border: 0; border-top-left-radius: 24px; border-top-right-radius: 24px;" />
            </td>
          </tr>

          <!-- Card Body Content -->
          <tr>
            <td style="padding: 40px;">
              <!-- Small Logo and Brand -->
              <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="vertical-align: middle; padding-right: 8px;">
                    <img src="${logoUrl}" alt="VGR Logo" width="28" height="28" style="display: block; border: 0; outline: none;" />
                  </td>
                  <td align="center" style="vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 800; color: #88889a; letter-spacing: 0.2em; text-transform: uppercase;">
                    VGR Studio
                  </td>
                </tr>
              </table>

              <!-- Badge and Title -->
              <div style="text-align: center; margin-bottom: 28px;">
                <p style="margin: 0 0 6px 0; font-size: 10px; font-weight: 700; color: #E8449A; letter-spacing: 0.2em; text-transform: uppercase;">${escapeHtml(badgeText)}</p>
                <h1 style="margin: 0; font-family: Georgia, Cambria, 'Times New Roman', serif; font-size: 32px; font-style: italic; font-weight: 900; line-height: 1.15; color: #111827; letter-spacing: -0.01em;">
                  ${headingHtml}
                </h1>
              </div>

              <!-- Horizontal Separator -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1.5px solid #f1f1f5; margin-bottom: 28px;">
                <tr><td></td></tr>
              </table>

              <!-- Greeting and Message -->
              <div style="font-size: 15px; line-height: 1.6; color: #4b5563; margin-bottom: 28px;">
                <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #111827;">${greetingText}</p>
                <div style="margin: 0;">${messageHtml}</div>
              </div>

              <!-- Ticket Stub Scheduled Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #fafafd; border-radius: 16px; border: 1.5px dashed #d1d5db; overflow: hidden; margin-bottom: 32px;">
                <tr>
                  <!-- Left Side Stub (Icon / Calendar Emoji) -->
                  <td width="20%" align="center" style="padding: 16px; border-right: 1.5px dashed #d1d5db; background-color: #f5f8fb; text-align: center; vertical-align: middle;">
                    <span style="font-size: 26px; line-height: 1; display: inline-block;">${detailIcon}</span>
                  </td>
                  <!-- Right Side Stub (Date & Time details) -->
                  <td width="80%" style="padding: 16px 20px; text-align: left; vertical-align: middle;">
                    <p style="margin: 0 0 4px 0; font-size: 9px; font-weight: 700; color: #E8449A; letter-spacing: 0.15em; text-transform: uppercase;">${escapeHtml(detailEyebrow)}</p>
                    <p style="margin: 0 0 2px 0; font-size: 15px; font-weight: 800; color: #111827;">${escapeHtml(revealDateLabel)}</p>
                    <p style="margin: 0; font-size: 13px; font-weight: 600; color: #4b5563;">${escapeHtml(revealTimeLabel)} <span style="font-size: 11px; font-weight: 700; color: #9ca3af;">(${escapeHtml(revealTimezone)})</span></p>
                  </td>
                </tr>
              </table>

              <!-- Primary CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:wml" href="${primaryCtaUrl}" style="height:52px;v-text-anchor:middle;width:280px;" arcsize="50%" stroke="f" fillcolor="#E8449A">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">${escapeHtml(primaryCtaText)}</center>
                    </v:roundrect>
                    <![endif]-->
                    <a href="${primaryCtaUrl}" style="background: linear-gradient(135deg, #E8449A 0%, #3A9FE8 100%); background-color: #E8449A; color: #ffffff; display: block; font-size: 15px; font-weight: 700; text-align: center; text-decoration: none; line-height: 52px; width: 100%; border-radius: 26px; box-shadow: 0 5px 15px rgba(232, 68, 154, 0.25); outline: none; letter-spacing: 0.05em;">✨ ${escapeHtml(primaryCtaText)} ✦</a>
                  </td>
                </tr>
              </table>

              <!-- Add to Calendar Link Bar -->
              ${showCalendar ? `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-bottom: 12px; text-align: center;">
                <tr>
                  <td align="center" style="font-size: 12px; font-weight: 700; color: #88889a; letter-spacing: 0.1em; padding-bottom: 8px; text-align: center;">
                    📅 ADD TO CALENDAR
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size: 12px; font-weight: 700; text-align: center;">
                    ${googleCalendarUrl ? `<a href="${googleCalendarUrl}" target="_blank" style="color: #3A9FE8; text-decoration: none; margin-right: 12px;">Google Calendar</a>` : ""}
                    ${googleCalendarUrl && icsUrl ? `<span style="color: #d1d5db; margin-right: 12px;">|</span>` : ""}
                    ${icsUrl ? `<a href="${icsUrl}" style="color: #3A9FE8; text-decoration: none;">Apple / Outlook (.ics)</a>` : ""}
                  </td>
                </tr>
              </table>
              ` : ""}

              <!-- Bottom Separator -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1.5px solid #f1f1f5; margin: 28px 0;">
                <tr><td></td></tr>
              </table>

              <!-- Closing Hand-written style signoff -->
              <div style="text-align: center;">
                <p style="margin: 0 0 8px 0; font-family: Georgia, Cambria, serif; font-size: 15px; font-style: italic; font-weight: 600; color: #4b5563;">We can't wait to celebrate with you and share this special moment!</p>
                <p style="margin: 0; font-size: 18px;">💖 ✨ 💙</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Troubleshooting Muted Footer -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; text-align: center;">
          <tr>
            <td align="center" style="padding: 24px 20px 0 20px; font-size: 11px; line-height: 1.5; color: #9ca3af; text-align: center; font-weight: 500;">
              ${escapeHtml(troubleshootingNote)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildGuestInviteEmailHtml(params: SendGuestInviteEmailParams): string {
  const guestName = escapeHtml(params.guestName || "there");
  const parentName = escapeHtml(params.parentName);
  const inviteUrl = escapeHtml(params.inviteUrl);
  const googleCalendarUrl = params.googleCalendarUrl ? escapeHtml(params.googleCalendarUrl) : null;
  const icsUrl = params.icsUrl ? escapeHtml(params.icsUrl) : null;

  const dateObj = new Date(params.revealAtIso);
  const revealDateLabel = dateObj.toLocaleDateString("en-US", {
    dateStyle: "full",
    timeZone: params.revealTimezone,
  });
  const revealTimeLabel = dateObj.toLocaleTimeString("en-US", {
    timeStyle: "short",
    timeZone: params.revealTimezone,
  });

  const baseUrl = new URL(params.inviteUrl).origin;
  const logoUrl = `${baseUrl}/Favicon-VGR.png?v=${EMAIL_ASSET_VERSION}`;
  const bannerUrl = `${baseUrl}/assets/email-banner.png?v=${EMAIL_ASSET_VERSION}`;

  return buildVgrEmailTemplateHtml({
    logoUrl,
    bannerUrl,
    badgeText: "You're invited to a",
    headingHtml: `<span style="color: #E8449A;">Virtual</span> <span style="color: #3A9FE8;">Gender Reveal!</span>`,
    greetingText: `Hi ${guestName},`,
    messageHtml: `<p style="margin: 0;"><strong>${parentName}</strong> invited you to their virtual gender reveal celebration! Join the family online to share predictions, leave comments, and watch the cinematic reveal live.</p>`,
    revealDateLabel,
    revealTimeLabel,
    revealTimezone: params.revealTimezone,
    primaryCtaUrl: inviteUrl,
    primaryCtaText: "JOIN THE PARTY",
    googleCalendarUrl,
    icsUrl,
  });
}

export async function sendGuestInviteEmail(params: SendGuestInviteEmailParams): Promise<void> {
  const html = buildGuestInviteEmailHtml(params);
  await sendEmail({ to: params.to, subject: "You're invited to a Gender Reveal", html });
}

export async function sendHostInvitationConfirmationEmail(params: SendHostInvitationConfirmationEmailParams): Promise<void> {
  const inviteUrl = escapeHtml(params.inviteUrl);
  const googleCalendarUrl = params.googleCalendarUrl ? escapeHtml(params.googleCalendarUrl) : null;
  const icsUrl = params.icsUrl ? escapeHtml(params.icsUrl) : null;

  const dateObj = new Date(params.revealAtIso);
  const revealDateLabel = dateObj.toLocaleDateString("en-US", {
    dateStyle: "full",
    timeZone: params.revealTimezone,
  });
  const revealTimeLabel = dateObj.toLocaleTimeString("en-US", {
    timeStyle: "short",
    timeZone: params.revealTimezone,
  });

  const baseUrl = new URL(params.inviteUrl).origin;
  const logoUrl = `${baseUrl}/Favicon-VGR.png?v=${EMAIL_ASSET_VERSION}`;
  const bannerUrl = `${baseUrl}/assets/email-banner.png?v=${EMAIL_ASSET_VERSION}`;

  const html = buildVgrEmailTemplateHtml({
    logoUrl,
    bannerUrl,
    badgeText: "Congratulations!",
    headingHtml: `<span style="color: #E8449A;">Your Reveal</span> <span style="color: #3A9FE8;">Is Ready!</span>`,
    greetingText: `Hi there,`,
    messageHtml: `<p style="margin: 0 0 12px 0;">Thank you for choosing Virtual Gender Reveal to share this special moment!</p>
                  <p style="margin: 0;">Your guest invitations have been successfully sent. Everything is prepared for your celebration. You can continue to manage your reveal, review guest responses, and follow your live event from your dashboard.</p>`,
    revealDateLabel,
    revealTimeLabel,
    revealTimezone: params.revealTimezone,
    primaryCtaUrl: inviteUrl,
    primaryCtaText: "OPEN CELEBRATION LINK",
    googleCalendarUrl,
    icsUrl,
  });

  await sendEmail({
    to: params.to,
    subject: "Your Virtual Gender Reveal Is Ready to Share!",
    html,
  });
}

export async function sendGuestDigestEmail(params: SendGuestDigestEmailParams): Promise<void> {
  const parentName = escapeHtml(params.parentName || "there");
  const revealDateLabel = escapeHtml(params.revealDateLabel);
  const rows = params.responses
    .map((r) => `<li><strong>${escapeHtml(r.name)}</strong> guessed <strong>${escapeHtml(r.prediction)}</strong>${r.message ? ` - "${escapeHtml(r.message)}"` : ""}</li>`)
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Your guest predictions are in 🎉</h2>
      <p>Hi ${parentName}, here are the guest responses for your reveal (${revealDateLabel}).</p>
      <ul>${rows || "<li>No responses yet.</li>"}</ul>
    </div>
  `;

  await sendEmail({ to: params.to, subject: "Guest predictions & notes", html });
}

export async function sendGuestReminderEmail(params: SendGuestReminderEmailParams): Promise<void> {
  const guestName = escapeHtml(params.guestName || "there");
  const parentName = escapeHtml(params.parentName || "the parents");
  const inviteUrl = escapeHtml(params.inviteUrl);

  const dateObj = new Date(params.revealAtIso);
  const revealDateLabel = dateObj.toLocaleDateString("en-US", {
    dateStyle: "full",
    timeZone: params.revealTimezone,
  });
  const revealTimeLabel = dateObj.toLocaleTimeString("en-US", {
    timeStyle: "short",
    timeZone: params.revealTimezone,
  });

  const baseUrl = new URL(params.inviteUrl).origin;
  const logoUrl = `${baseUrl}/Favicon-VGR.png?v=${EMAIL_ASSET_VERSION}`;
  const bannerUrl = `${baseUrl}/assets/email-banner.png?v=${EMAIL_ASSET_VERSION}`;

  // Dynamically build calendar links for reminders
  const token = inviteUrl.substring(inviteUrl.lastIndexOf("/") + 1);
  const icsUrl = `${baseUrl}/api/guest/${token}/calendar.ics`;

  const start = new Date(params.revealAtIso);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${params.parentName || "Parents"}'s Virtual Gender Reveal`)}&dates=${fmt(start)}/${fmt(end)}&ctz=${encodeURIComponent(params.revealTimezone || "UTC")}&details=${encodeURIComponent(`Join the reveal: ${inviteUrl}`)}`;

  const html = buildVgrEmailTemplateHtml({
    logoUrl,
    bannerUrl,
    badgeText: "Reminder",
    headingHtml: `<span style="color: #E8449A;">Reveal is</span> <span style="color: #3A9FE8;">Tomorrow!</span> 🎈`,
    greetingText: `Hi ${guestName},`,
    messageHtml: `<p style="margin: 0;">This is a friendly reminder from <strong>${parentName}</strong>. The virtual gender reveal party is tomorrow! Click the button below to join the celebration.</p>`,
    revealDateLabel,
    revealTimeLabel,
    revealTimezone: params.revealTimezone,
    primaryCtaUrl: inviteUrl,
    primaryCtaText: "JOIN THE PARTY",
    googleCalendarUrl,
    icsUrl,
  });

  await sendEmail({ to: params.to, subject: "Reminder: Virtual Gender Reveal tomorrow", html });
}

export async function sendRevealReminderEmail(params: SendRevealReminderEmailParams): Promise<void> {
  return sendGuestReminderEmail({ ...params, inviteUrl: params.inviteUrl || "" });
}

export interface SendHostCreationConfirmationEmailParams {
  to: string;
  parentName: string;
  revealAtIso: string;
  revealTimezone: string;
  dashboardUrl: string;
}

export interface SendHostVideoReadyEmailParams {
  to: string;
  parentName: string;
  revealAtIso: string;
  revealTimezone: string;
  dashboardUrl: string;
}

export interface SendHostAnnouncementCreationEmailParams {
  to: string;
  parentName: string;
  dashboardUrl: string;
}

export interface SendHostAnnouncementVideoReadyEmailParams {
  to: string;
  parentName: string;
  downloadUrl: string;
  dashboardUrl: string;
}

export interface SendHostRevealReminderEmailParams {
  to: string;
  parentName: string;
  revealAtIso: string;
  revealTimezone: string;
  dashboardUrl: string;
  boyVotes: number;
  girlVotes: number;
}

export async function sendHostCreationConfirmationEmail(params: SendHostCreationConfirmationEmailParams): Promise<void> {
  const parentName = escapeHtml(params.parentName);
  const dashboardUrl = escapeHtml(params.dashboardUrl);

  const dateObj = new Date(params.revealAtIso);
  const revealDateLabel = dateObj.toLocaleDateString("en-US", {
    dateStyle: "full",
    timeZone: params.revealTimezone,
  });
  const revealTimeLabel = dateObj.toLocaleTimeString("en-US", {
    timeStyle: "short",
    timeZone: params.revealTimezone,
  });

  const baseUrl = new URL(dashboardUrl).origin;
  const logoUrl = `${baseUrl}/Favicon-VGR.png?v=${EMAIL_ASSET_VERSION}`;
  const bannerUrl = `${baseUrl}/assets/email-banner.png?v=${EMAIL_ASSET_VERSION}`;

  const html = buildVgrEmailTemplateHtml({
    logoUrl,
    bannerUrl,
    badgeText: "Reveal Created",
    headingHtml: `<span style="color: #E8449A;">Your Reveal</span> <span style="color: #3A9FE8;">Is Created!</span>`,
    greetingText: `Hi ${parentName},`,
    messageHtml: `<p style="margin: 0 0 12px 0;">Congratulations on creating your Virtual Gender Reveal event! Everything is successfully set up and ready to go.</p>
                  <p style="margin: 0 0 12px 0;"><strong>Here is what you need to do next:</strong></p>
                  <ul style="margin: 0 0 16px 0; padding-left: 20px; color: #4b5563;">
                    <li style="margin-bottom: 6px;">Share your Guest Invite Link to collect votes and predictions.</li>
                    <li style="margin-bottom: 6px;">For Reveal events, make sure your doctor or designated revealer submits the gender using their secure link.</li>
                    <li style="margin-bottom: 6px;">Log in to your Host Dashboard to view predictions, manage messages, and track your livestream.</li>
                  </ul>`,
    revealDateLabel,
    revealTimeLabel,
    revealTimezone: params.revealTimezone,
    primaryCtaUrl: dashboardUrl,
    primaryCtaText: "GO TO DASHBOARD",
  });

  await sendEmail({
    to: params.to,
    subject: "Your Virtual Gender Reveal has been created!",
    html,
  });
}

export async function sendHostAnnouncementCreationEmail(
  params: SendHostAnnouncementCreationEmailParams
): Promise<void> {
  const parentName = escapeHtml(params.parentName);
  const dashboardUrl = escapeHtml(params.dashboardUrl);
  const baseUrl = new URL(params.dashboardUrl).origin;
  const logoUrl = `${baseUrl}/Favicon-VGR.png?v=${EMAIL_ASSET_VERSION}`;
  const bannerUrl = `${baseUrl}/assets/email-banner.png?v=${EMAIL_ASSET_VERSION}`;

  const html = buildVgrEmailTemplateHtml({
    logoUrl,
    bannerUrl,
    badgeText: "Custom Video Requested",
    headingHtml: `<span style="color: #E8449A;">Your Personalized Video</span> <span style="color: #3A9FE8;">Is in Production!</span>`,
    greetingText: `Hi ${parentName},`,
    messageHtml: `<p style="margin: 0 0 12px 0;">We received your Bundle of Joy announcement request and our team will now prepare a customized video just for you.</p>
                  <p style="margin: 0;">There is no party date to manage. We will email you as soon as your video is ready to download, and the download button will also appear in your dashboard.</p>`,
    revealDateLabel: "Personalized Video",
    revealTimeLabel: "Customization in progress",
    revealTimezone: "We’ll notify you when it’s ready",
    detailEyebrow: "Production Status",
    detailIcon: "🎬",
    primaryCtaUrl: dashboardUrl,
    primaryCtaText: "VIEW VIDEO STATUS",
  });

  await sendEmail({
    to: params.to,
    subject: "Your personalized announcement video is in production",
    html,
  });
}

export async function sendHostAnnouncementVideoReadyEmail(
  params: SendHostAnnouncementVideoReadyEmailParams
): Promise<void> {
  const parentName = escapeHtml(params.parentName);
  const downloadUrl = escapeHtml(params.downloadUrl);
  const baseUrl = new URL(params.dashboardUrl).origin;
  const logoUrl = `${baseUrl}/Favicon-VGR.png?v=${EMAIL_ASSET_VERSION}`;
  const bannerUrl = `${baseUrl}/assets/email-banner.png?v=${EMAIL_ASSET_VERSION}`;

  const html = buildVgrEmailTemplateHtml({
    logoUrl,
    bannerUrl,
    badgeText: "Custom Video Ready",
    headingHtml: `<span style="color: #E8449A;">Your Personalized Video</span> <span style="color: #3A9FE8;">Is Ready!</span> 🎬`,
    greetingText: `Hi ${parentName},`,
    messageHtml: `<p style="margin: 0 0 12px 0;">Your customized Bundle of Joy announcement video has been prepared and is ready to keep forever.</p>
                  <p style="margin: 0;">Click the button below to download the MP4. You can also download it anytime from your dashboard.</p>`,
    revealDateLabel: "Personalized Announcement",
    revealTimeLabel: "Ready to download",
    revealTimezone: "MP4 keepsake",
    detailEyebrow: "Video Status",
    detailIcon: "✨",
    primaryCtaUrl: downloadUrl,
    primaryCtaText: "DOWNLOAD YOUR VIDEO",
    troubleshootingNote:
      "If the download is still preparing, wait a moment and use the download button in your dashboard.",
  });

  await sendEmail({
    to: params.to,
    subject: "Your personalized announcement video is ready to download!",
    html,
  });
}

export async function sendHostVideoReadyEmail(params: SendHostVideoReadyEmailParams): Promise<void> {
  const parentName = escapeHtml(params.parentName);
  const dashboardUrl = escapeHtml(params.dashboardUrl);

  const dateObj = new Date(params.revealAtIso);
  const revealDateLabel = dateObj.toLocaleDateString("en-US", {
    dateStyle: "full",
    timeZone: params.revealTimezone,
  });
  const revealTimeLabel = dateObj.toLocaleTimeString("en-US", {
    timeStyle: "short",
    timeZone: params.revealTimezone,
  });

  const baseUrl = new URL(dashboardUrl).origin;
  const logoUrl = `${baseUrl}/Favicon-VGR.png?v=${EMAIL_ASSET_VERSION}`;
  const bannerUrl = `${baseUrl}/assets/email-banner.png?v=${EMAIL_ASSET_VERSION}`;

  const html = buildVgrEmailTemplateHtml({
    logoUrl,
    bannerUrl,
    badgeText: "Video Ready",
    headingHtml: `<span style="color: #E8449A;">Your Video</span> <span style="color: #3A9FE8;">Is Processed!</span> 🎬`,
    greetingText: `Hi ${parentName},`,
    messageHtml: `<p style="margin: 0 0 12px 0;">Exciting news! Your custom reveal video has been successfully processed and is ready for the broadcast.</p>
                  <p style="margin: 0;">Your virtual party room is now fully prepared. The video will automatically unlock for you and your guests when the countdown reaches zero.</p>`,
    revealDateLabel,
    revealTimeLabel,
    revealTimezone: params.revealTimezone,
    primaryCtaUrl: dashboardUrl,
    primaryCtaText: "VIEW CELEBRATION ROOM",
  });

  await sendEmail({
    to: params.to,
    subject: "Your custom reveal video is ready!",
    html,
  });
}

export async function sendHostRevealReminderEmail(params: SendHostRevealReminderEmailParams): Promise<void> {
  const parentName = escapeHtml(params.parentName);
  const dashboardUrl = escapeHtml(params.dashboardUrl);

  const dateObj = new Date(params.revealAtIso);
  const revealDateLabel = dateObj.toLocaleDateString("en-US", {
    dateStyle: "full",
    timeZone: params.revealTimezone,
  });
  const revealTimeLabel = dateObj.toLocaleTimeString("en-US", {
    timeStyle: "short",
    timeZone: params.revealTimezone,
  });

  const baseUrl = new URL(dashboardUrl).origin;
  const logoUrl = `${baseUrl}/Favicon-VGR.png?v=${EMAIL_ASSET_VERSION}`;
  const bannerUrl = `${baseUrl}/assets/email-banner.png?v=${EMAIL_ASSET_VERSION}`;

  const html = buildVgrEmailTemplateHtml({
    logoUrl,
    bannerUrl,
    badgeText: "Event Tomorrow",
    headingHtml: `<span style="color: #E8449A;">Your Reveal</span> <span style="color: #3A9FE8;">Is Tomorrow!</span> 🎈`,
    greetingText: `Hi ${parentName},`,
    messageHtml: `<p style="margin: 0 0 12px 0;">The wait is almost over! Your Virtual Gender Reveal celebration starts tomorrow.</p>
                  <p style="margin: 0 0 16px 0;">Here is a quick look at your guest voting stats so far:</p>
                  <div style="background-color: #f8fafc; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; border: 1px solid #e2e8f0; display: inline-block; min-width: 200px; text-align: center;">
                    <span style="color: #3A9FE8; font-weight: 800; font-size: 16px; margin-right: 16px;">💙 Team Boy: ${params.boyVotes}</span>
                    <span style="color: #E8449A; font-weight: 800; font-size: 16px;">🩷 Team Girl: ${params.girlVotes}</span>
                  </div>
                  <p style="margin: 0;">Make sure your streaming device is ready, and click below to access your host dashboard.</p>`,
    revealDateLabel,
    revealTimeLabel,
    revealTimezone: params.revealTimezone,
    primaryCtaUrl: dashboardUrl,
    primaryCtaText: "OPEN HOST DASHBOARD",
  });

  await sendEmail({
    to: params.to,
    subject: "Reminder: Your Virtual Gender Reveal is tomorrow!",
    html,
  });
}

export interface SendHostDownloadReminderEmailParams {
  to: string;
  parentName: string;
  dashboardUrl: string;
}

export async function sendHostDownloadReminder1dEmail(params: SendHostDownloadReminderEmailParams): Promise<void> {
  const parentName = escapeHtml(params.parentName);
  const dashboardUrl = escapeHtml(params.dashboardUrl);

  const baseUrl = new URL(dashboardUrl).origin;
  const logoUrl = `${baseUrl}/Favicon-VGR.png?v=${EMAIL_ASSET_VERSION}`;
  const bannerUrl = `${baseUrl}/assets/email-banner.png?v=${EMAIL_ASSET_VERSION}`;

  const html = buildVgrEmailTemplateHtml({
    logoUrl,
    bannerUrl,
    badgeText: "Reveal Complete",
    headingHtml: `<span style="color: #E8449A;">Congratulations on</span> <span style="color: #3A9FE8;">Your Reveal!</span> 🎉`,
    greetingText: `Hi ${parentName},`,
    messageHtml: `<p style="margin: 0 0 12px 0;">Congratulations on your Virtual Gender Reveal event! We hope you and your family had a wonderful time celebrating this special milestone.</p>
                  <p style="margin: 0 0 12px 0;">Thank you so much for choosing <strong>Virtual Gender Reveal</strong>. Your personalized animated reveal video is ready to download so you can keep and relive it forever.</p>
                  <p style="margin: 0 0 16px 0; color: #b91c1c; font-weight: 700;">⚠️ Please note: To free up secure server storage space, your video file will be permanently deleted in 30 days. Be sure to download and save it today!</p>`,
    primaryCtaUrl: dashboardUrl,
    primaryCtaText: "DOWNLOAD KEEPSAKE VIDEO",
  });

  await sendEmail({
    to: params.to,
    subject: "Congratulations on your Reveal! Download your keepsake video",
    html,
  });
}

export async function sendHostDownloadReminder7dEmail(params: SendHostDownloadReminderEmailParams): Promise<void> {
  const parentName = escapeHtml(params.parentName);
  const dashboardUrl = escapeHtml(params.dashboardUrl);

  const baseUrl = new URL(dashboardUrl).origin;
  const logoUrl = `${baseUrl}/Favicon-VGR.png?v=${EMAIL_ASSET_VERSION}`;
  const bannerUrl = `${baseUrl}/assets/email-banner.png?v=${EMAIL_ASSET_VERSION}`;

  const html = buildVgrEmailTemplateHtml({
    logoUrl,
    bannerUrl,
    badgeText: "Download Warning",
    headingHtml: `<span style="color: #E8449A;">7 Days Left</span> <span style="color: #3A9FE8;">To Save Video</span> ⏳`,
    greetingText: `Hi ${parentName},`,
    messageHtml: `<p style="margin: 0 0 12px 0;">This is a friendly reminder to download your keepsake Virtual Gender Reveal video.</p>
                  <p style="margin: 0 0 16px 0; color: #b91c1c; font-weight: 700;">⚠️ Your custom video will be permanently deleted from our servers in 7 days to clear secure storage space. Please download it now to avoid losing it!</p>`,
    primaryCtaUrl: dashboardUrl,
    primaryCtaText: "DOWNLOAD VIDEO NOW",
  });

  await sendEmail({
    to: params.to,
    subject: "Action Required: 7 days left to download your reveal video",
    html,
  });
}

export async function sendHostDownloadReminder24hEmail(params: SendHostDownloadReminderEmailParams): Promise<void> {
  const parentName = escapeHtml(params.parentName);
  const dashboardUrl = escapeHtml(params.dashboardUrl);

  const baseUrl = new URL(dashboardUrl).origin;
  const logoUrl = `${baseUrl}/Favicon-VGR.png?v=${EMAIL_ASSET_VERSION}`;
  const bannerUrl = `${baseUrl}/assets/email-banner.png?v=${EMAIL_ASSET_VERSION}`;

  const html = buildVgrEmailTemplateHtml({
    logoUrl,
    bannerUrl,
    badgeText: "Final Warning",
    headingHtml: `<span style="color: #E8449A;">24 Hours Left</span> <span style="color: #3A9FE8;">To Save Video</span> 🚨`,
    greetingText: `Hi ${parentName},`,
    messageHtml: `<p style="margin: 0 0 12px 0;">This is your final notice to download your custom Virtual Gender Reveal video.</p>
                  <p style="margin: 0 0 16px 0; color: #b91c1c; font-weight: 800;">⚠️ Critical: Your custom video is scheduled for permanent deletion in 24 hours. After this time, it cannot be recovered. Please click the button below to download and save it immediately.</p>`,
    primaryCtaUrl: dashboardUrl,
    primaryCtaText: "DOWNLOAD KEEPSAKE VIDEO NOW",
  });

  await sendEmail({
    to: params.to,
    subject: "Final Notice: 24 hours left to download your reveal video",
    html,
  });
}
