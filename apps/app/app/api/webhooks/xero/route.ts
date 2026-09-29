/**
 * POST /api/webhooks/xero
 *
 * Receives Xero webhook events. Verifies x-xero-signature over the raw body
 * before anything else and rejects with 401 (empty body) otherwise. Valid
 * requests get an immediate empty 200 — Xero requires a response within 5s —
 * and the events are processed afterwards via waitUntil.
 *
 * Signing key: XERO_WEBHOOK_SIGNING_KEY, from the Xero app's Webhooks tab.
 */

import { NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import {
  processXeroEvents,
  verifyXeroSignature,
  type XeroWebhookPayload,
} from "@/lib/xero/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!verifyXeroSignature(rawBody, request.headers.get("x-xero-signature"))) {
    return new Response(null, { status: 401 });
  }

  let payload: XeroWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as XeroWebhookPayload;
  } catch {
    return new Response(null, { status: 400 });
  }

  // Intent-to-receive validation sends an empty events array — nothing to do.
  if (payload.events?.length) {
    waitUntil(
      processXeroEvents(payload).catch((err) =>
        console.error("Xero webhook processing failed:", err)
      )
    );
  }

  return new Response(null, { status: 200 });
}
