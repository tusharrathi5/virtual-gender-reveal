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

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Virtual Gender Reveal Invitation</h2>
      <p>${parentName} invited you as their ${relationLabel} to securely submit the baby's gender.</p>
      <p>Please use this one-time secure link:</p>
      <p><a href="${revealUrl}">${revealUrl}</a></p>
      <p>This link expires in 7 days.</p>
      <p style="color:#666;font-size:12px">Enquiry ID: ${escapeHtml(params.enquiryId)}</p>
    </div>
  `;

  await sendEmail({
    to: params.to,
    subject: "Secure Gender Submission Link",
    html,
  });
}

export async function sendWelcomeEmail(params: SendWelcomeEmailParams): Promise<void> {
  const name = escapeHtml(params.fullName || "there");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Welcome to Virtual Gender Reveal 🎉</h2>
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
