import { createHmac, timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@stky/db";
import { getSystemUserId, logActivity } from "@/lib/server/activity-log";
import { logStky } from "@/lib/observability";
import { getInvoice } from "./client";

/**
 * Xero webhooks: x-xero-signature is base64(HMAC-SHA256(raw body, signing key)).
 * Anything unsigned or mis-signed must get a 401 — Xero's "intent to receive"
 * check deliberately sends a bad signature and expects exactly that.
 */
export function verifyXeroSignature(rawBody: string, signature: string | null): boolean {
  const key = process.env.XERO_WEBHOOK_SIGNING_KEY;
  if (!key || !signature) return false; // never accept when unconfigured

  const expected = createHmac("sha256", key).update(rawBody, "utf8").digest();
  let given: Buffer;
  try {
    given = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type XeroWebhookEvent = {
  resourceId: string;
  eventCategory: string; // INVOICE | CONTACT | ...
  eventType: string; // CREATE | UPDATE
  tenantId: string;
  eventDateUtc?: string;
};

export type XeroWebhookPayload = { events?: XeroWebhookEvent[] };

const STATUS_PHRASE: Record<string, string> = {
  DRAFT: "saved as Draft",
  SUBMITTED: "submitted for approval",
  AUTHORISED: "approved (awaiting payment)",
  PAID: "marked as Paid",
  VOIDED: "voided",
  DELETED: "deleted",
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

/**
 * Runs after the 200 has been sent. The payload only says which invoice
 * changed, so the invoice is fetched to find its contact and current status.
 */
export async function processXeroEvents(payload: XeroWebhookPayload) {
  const events = (payload.events ?? []).filter((e) => e.eventCategory === "INVOICE");
  if (events.length === 0) return;

  const cred = await prisma.xeroCredential.findFirst({ select: { tenantId: true } });
  if (!cred) return;

  for (const event of events) {
    try {
      if (event.tenantId !== cred.tenantId) {
        logStky("xero_webhook_other_tenant", { tenantId: event.tenantId });
        continue;
      }

      const invoice = await getInvoice(event.resourceId);
      if (!invoice) continue; // bills (ACCPAY) or not found

      const clients = await prisma.client.findMany({
        where: { xeroContactId: invoice.contactId },
        select: { id: true },
      });
      if (clients.length === 0) {
        logStky("xero_webhook_unmapped_contact", { invoiceId: invoice.invoiceId });
        continue;
      }

      const label = invoice.number ? `Invoice #${invoice.number}` : "Draft invoice";
      const verb = event.eventType === "CREATE" ? "created" : "updated";
      const phrase = STATUS_PHRASE[invoice.status] ?? `${verb} (${invoice.status})`;
      const body =
        `${label} ${phrase} via Xero — total ${money(invoice.total, invoice.currency)}` +
        (invoice.amountDue > 0 ? `, ${money(invoice.amountDue, invoice.currency)} outstanding.` : ".");

      const actorId = await getSystemUserId();
      for (const c of clients) {
        await logActivity({ clientId: c.id, type: "xero_invoice", body, actorId });
        try {
          revalidatePath(`/dashboard/clients/${c.id}`);
        } catch (err) {
          // Runs after the response; don't let a cache hiccup drop later entries.
          console.error("Xero webhook revalidate failed:", err);
        }
      }
    } catch (err) {
      console.error("Xero webhook event failed:", event.resourceId, err);
    }
  }
}
