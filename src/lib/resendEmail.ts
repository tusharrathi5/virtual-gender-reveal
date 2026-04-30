export interface SendDoctorInviteParams {
  to: string;
  parentName: string;
  relationLabel: string;
  revealUrl: string;
  enquiryId: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendDoctorInviteEmail(params: SendDoctorInviteParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error("RESEND_NOT_CONFIGURED");
  }

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

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: "Secure Gender Submission Link",
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RESEND_SEND_FAILED: ${response.status} ${text}`);
  }
}
