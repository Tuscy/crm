import crypto from "crypto";
import { prisma } from "@stky/db";
import type { Prisma } from "@stky/db";
import { logStky } from "@/lib/observability";
import { appendEvent, type TicketActor } from "@/lib/tickets/log";
import { postTicketAlert } from "@/lib/slack/ticket-mirror";

/**
 * Signed, retried ticket webhooks (contracts/webhook-events.md).
 * Rows are written in the same transaction as the ticket change, so an event
 * is never lost; delivery is attempted straight after commit and by the
 * /api/cron/webhook-retries route. Off unless TICKET_WEBHOOK_URL and
 * TICKET_WEBHOOK_SECRET are both set.
 */

export type TicketWebhookEvent =
  | "ticket.created"
  | "ticket.message_added"
  | "ticket.status_changed"
  | "ticket.assigned";

/** Seconds to wait after the 1st, 2nd, 3rd and 4th failed attempt. A 5th failure is dead-lettered. */
export const BACKOFF_SECONDS = [60, 5 * 60, 30 * 60, 2 * 60 * 60] as const;
export const MAX_ATTEMPTS = BACKOFF_SECONDS.length + 1;
const CLAIM_SECONDS = 5 * 60;
const TIMEOUT_MS = 10_000;

/** Delay before the next try, or null when the delivery is out of attempts. */
export function nextBackoffSeconds(attemptsMade: number): number | null {
  if (attemptsMade >= MAX_ATTEMPTS) return null;
  return BACKOFF_SECONDS[attemptsMade - 1] ?? null;
}

export function signBody(secret: string, body: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

function config() {
  const url = process.env.TICKET_WEBHOOK_URL;
  const secret = process.env.TICKET_WEBHOOK_SECRET;
  return url && secret ? { url, secret } : null;
}

export function ticketWebhooksEnabled(): boolean {
  return config() !== null;
}

type SnapshotTicket = {
  id: string;
  reference: string;
  clientId: string;
  siteId: string | null;
  type: string;
  status: string;
  priority: string;
  agentEligible: boolean;
  assigneeType: string;
  assigneeId: string | null;
};

export function ticketSnapshot(t: SnapshotTicket) {
  return {
    id: t.id,
    reference: t.reference,
    clientId: t.clientId,
    siteId: t.siteId,
    type: t.type,
    status: t.status,
    priority: t.priority,
    agentEligible: t.agentEligible,
    assigneeType: t.assigneeType,
    assigneeId: t.assigneeId,
  };
}

/**
 * Queue an event inside the caller's transaction. Returns the delivery id to
 * pass to deliverAfterCommit(), or null when webhooks are off.
 */
export async function enqueueTicketWebhook(
  tx: Prisma.TransactionClient,
  input: {
    ticket: SnapshotTicket;
    event: TicketWebhookEvent;
    actor: TicketActor;
    data?: Record<string, unknown>;
  }
): Promise<string | null> {
  if (!config()) return null;
  const id = crypto.randomUUID();
  const payload = {
    id,
    event: input.event,
    createdAt: new Date().toISOString(),
    ticket: ticketSnapshot(input.ticket),
    actor: { type: input.actor.type, name: input.actor.name ?? null },
    data: input.data ?? {},
  };
  await tx.webhookDelivery.create({
    data: {
      id,
      ticketId: input.ticket.id,
      event: input.event,
      payload: payload as Prisma.InputJsonValue,
    },
  });
  return id;
}

async function logAttempt(
  ticketId: string | null,
  payload: Record<string, unknown>
): Promise<void> {
  if (!ticketId) return;
  try {
    await prisma.$transaction((tx) =>
      appendEvent(tx, {
        ticketId,
        kind: "webhook.delivery",
        actor: { type: "SYSTEM", name: "webhook" },
        payload,
      })
    );
  } catch (error) {
    // The ticket may have been deleted (cascade); never fail delivery over logging.
    logStky("webhook_log_failed", { message: error instanceof Error ? error.message : "unknown" });
  }
}

/** Try one delivery. Safe to call concurrently: only one caller claims a due row. */
export async function attemptDelivery(id: string): Promise<"delivered" | "retry" | "dead" | "skipped"> {
  const cfg = config();
  if (!cfg) return "skipped";

  const now = new Date();
  const claimed = await prisma.webhookDelivery.updateMany({
    where: { id, status: "PENDING", nextAttemptAt: { lte: now } },
    data: { nextAttemptAt: new Date(now.getTime() + CLAIM_SECONDS * 1000) },
  });
  if (claimed.count !== 1) return "skipped";

  const row = await prisma.webhookDelivery.findUnique({ where: { id } });
  if (!row) return "skipped";

  const body = JSON.stringify(row.payload);
  let statusCode: number | null = null;
  let error: string | null = null;

  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Stky-Signature": signBody(cfg.secret, body),
        "X-Stky-Delivery": row.id,
        "X-Stky-Event": row.event,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    statusCode = res.status;
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : "request failed";
  }

  const attempts = row.attempts + 1;

  if (!error) {
    await prisma.webhookDelivery.update({
      where: { id },
      data: { status: "DELIVERED", attempts, lastStatusCode: statusCode, lastError: null, deliveredAt: new Date() },
    });
    await logAttempt(row.ticketId, { deliveryId: id, event: row.event, attempt: attempts, outcome: "delivered", statusCode });
    return "delivered";
  }

  const delay = nextBackoffSeconds(attempts);
  if (delay === null) {
    await prisma.webhookDelivery.update({
      where: { id },
      data: { status: "DEAD", attempts, lastStatusCode: statusCode, lastError: error },
    });
    await logAttempt(row.ticketId, { deliveryId: id, event: row.event, attempt: attempts, outcome: "dead", error, statusCode });
    await postTicketAlert(`:rotating_light: Ticket webhook gave up after ${attempts} attempts: ${row.event} (${error}). Delivery ${id}.`);
    return "dead";
  }

  await prisma.webhookDelivery.update({
    where: { id },
    data: {
      attempts,
      lastStatusCode: statusCode,
      lastError: error,
      nextAttemptAt: new Date(Date.now() + delay * 1000),
    },
  });
  await logAttempt(row.ticketId, { deliveryId: id, event: row.event, attempt: attempts, outcome: "retry", error, statusCode, retryInSeconds: delay });
  return "retry";
}

export async function deliverMany(ids: (string | null)[]): Promise<void> {
  for (const id of ids) {
    if (id) await attemptDelivery(id).catch((e) => logStky("webhook_attempt_failed", { message: e instanceof Error ? e.message : "unknown" }));
  }
}

/** Called by the cron route: retries everything that is due. */
export async function processDueDeliveries(limit = 25) {
  const due = await prisma.webhookDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const results = { delivered: 0, retry: 0, dead: 0, skipped: 0 };
  for (const { id } of due) results[await attemptDelivery(id)] += 1;
  return { due: due.length, ...results };
}
