import crypto from "crypto";
import { waitUntil } from "@vercel/functions";
import { logStky } from "@/lib/observability";

export type CrmWebhookEvent =
  | "lead.created"
  | "deal.created"
  | "deal.updated";

export async function dispatchCrmWebhook(
  event: CrmWebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const url = process.env.CRM_WEBHOOK_URL;
  const secret = process.env.CRM_WEBHOOK_SECRET;
  if (!url || !secret) {
    return;
  }

  const body = JSON.stringify({
    event,
    payload,
    ts: new Date().toISOString(),
  });

  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");

  // Deferred with waitUntil so the originating CRM action returns immediately
  // instead of waiting on this third-party call — a bare unawaited fetch()
  // would risk Vercel freezing/terminating the function before it completes.
  waitUntil(
    (async () => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Stky-Signature": `sha256=${sig}`,
          },
          body,
        });
        if (!res.ok) {
          logStky("webhook_http_error", {
            event,
            status: res.status,
          });
        }
      } catch (e) {
        logStky("webhook_fetch_error", {
          event,
          message: e instanceof Error ? e.message : "unknown",
        });
      }
    })()
  );
}
