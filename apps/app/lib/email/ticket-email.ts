import { logStky } from "@/lib/observability";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Sends a ticket update through Resend. The subject carries [TKT-nnnn] so replies thread via inbound email. */
export async function sendTicketEmail(params: {
  to: string;
  reference: string;
  subject: string;
  text: string;
  signedBy: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  if (!apiKey) return { ok: false, error: "Email is not configured. Set RESEND_API_KEY on the server." };

  const body = `${params.text}\n\n${params.signedBy}, StickySites`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: `[${params.reference}] ${params.subject}`,
      text: body,
      html: `<p>${escapeHtml(body).replace(/\n/g, "<br>")}</p>`,
    }),
  });
  if (!res.ok) {
    logStky("ticket_email_failed", { status: res.status });
    return { ok: false, error: `Email send failed (${res.status})` };
  }
  return { ok: true };
}
