import { prisma } from "@stky/db";
import type { Prisma } from "@stky/db";
import { waitUntil } from "@vercel/functions";
import { redactString } from "./redact";
import { appendEvent, type TicketActor } from "./log";
import { nextTicketReference } from "./reference";
import {
  resolveTransition,
  type TicketStatusName,
} from "./transitions";
import { mirrorStatusChanged, mirrorTicketCreated } from "@/lib/slack/ticket-mirror";
import { deliverMany, enqueueTicketWebhook } from "@/lib/webhooks/ticket-dispatch";

/**
 * The only module that writes tickets. Every change appends a TicketEvent
 * (redacted) in the same transaction, and status changes go through
 * transitionTicket() so the transition table and completion contract always apply.
 */

export { appendEvent, type TicketActor };

export const AI_DISCLOSURE = "(Drafted with AI assistance.)";

/** Anything an agent says to a customer carries the AI disclosure (constitution III). */
export function withAiDisclosure(body: string, authorType: TicketActor["type"], visibility: "PUBLIC" | "INTERNAL"): string {
  if (authorType !== "AGENT" || visibility !== "PUBLIC" || body.includes(AI_DISCLOSURE)) return body;
  return `${body}\n\n${AI_DISCLOSURE}`;
}

export class TicketError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "INVALID_TRANSITION" | "FORBIDDEN" | "INVALID"
  ) {
    super(message);
  }
}

export type CreateTicketInput = {
  clientId: string;
  siteId?: string | null;
  title: string;
  description: string;
  type?: Prisma.TicketCreateInput["type"];
  priority?: Prisma.TicketCreateInput["priority"];
  source: Prisma.TicketCreateInput["source"];
  requesterType: TicketActor["type"];
  requesterName?: string | null;
  requesterEmail?: string | null;
  agentEligible?: boolean;
};

export async function createTicket(input: CreateTicketInput, actor: TicketActor) {
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title || !description) throw new TicketError("Title and description are required", "INVALID");

  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
    select: { id: true, name: true },
  });
  if (!client) throw new TicketError("Client not found", "NOT_FOUND");

  if (input.siteId) {
    const site = await prisma.site.findUnique({
      where: { id: input.siteId },
      select: { clientId: true },
    });
    if (!site || site.clientId !== input.clientId) {
      throw new TicketError("Site does not belong to this client", "INVALID");
    }
  }

  const { ticket, deliveryId } = await prisma.$transaction(async (tx) => {
    const reference = await nextTicketReference(tx);
    const created = await tx.ticket.create({
      data: {
        reference,
        clientId: input.clientId,
        siteId: input.siteId ?? null,
        title: redactString(title),
        description: redactString(description),
        type: input.type ?? "OTHER",
        priority: input.priority ?? "NORMAL",
        source: input.source,
        requesterType: input.requesterType,
        requesterName: input.requesterName?.trim() || null,
        requesterEmail: input.requesterEmail?.trim() || null,
        agentEligible: input.agentEligible ?? false,
        statusSummary: "Received",
      },
    });
    await appendEvent(tx, {
      ticketId: created.id,
      kind: "ticket.created",
      actor,
      payload: { source: input.source, type: created.type, priority: created.priority },
    });
    const deliveryId = await enqueueTicketWebhook(tx, {
      ticket: created,
      event: "ticket.created",
      actor,
      data: { source: input.source, title: created.title, description: created.description },
    });
    return { ticket: created, deliveryId };
  });

  waitUntil(deliverMany([deliveryId]));
  waitUntil(
    mirrorTicketCreated({
      id: ticket.id,
      reference: ticket.reference,
      title: ticket.title,
      status: ticket.status,
      type: ticket.type,
      priority: ticket.priority,
      clientName: client.name,
    })
  );
  return ticket;
}

export type TransitionOptions = {
  summary?: string | null;
  finalMessage?: string | null;
  runId?: string | null;
};

/** Sole writer of Ticket.status. Returns the updated ticket and whether it was redirected to NEEDS_HUMAN. */
export async function transitionTicket(
  ticketId: string,
  to: TicketStatusName,
  actor: TicketActor,
  options: TransitionOptions = {}
) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`;
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      include: { client: { select: { name: true } } },
    });
    if (!ticket) throw new TicketError("Ticket not found", "NOT_FOUND");

    const from = ticket.status as TicketStatusName;
    const resolved = resolveTransition({
      from,
      to,
      summary: options.summary,
      finalMessage: options.finalMessage,
      existingSummary: ticket.statusSummary,
      existingFinalMessage: ticket.finalMessage,
    });
    if (!resolved.ok) throw new TicketError(resolved.error, "INVALID_TRANSITION");

    const now = new Date();
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: resolved.to,
        statusSummary: resolved.summary ? redactString(resolved.summary) : ticket.statusSummary,
        finalMessage: resolved.finalMessage
          ? redactString(resolved.finalMessage)
          : ticket.finalMessage,
        resolvedAt:
          resolved.to === "RESOLVED" || resolved.to === "CLOSED"
            ? (ticket.resolvedAt ?? now)
            : null,
      },
    });

    await appendEvent(tx, {
      ticketId,
      runId: options.runId,
      kind: "status.changed",
      actor,
      payload: {
        from,
        to: resolved.to,
        requested: to,
        redirected: resolved.redirected,
        reason: resolved.reason,
        summary: resolved.summary,
      },
    });

    const deliveryId = await enqueueTicketWebhook(tx, {
      ticket: updated,
      event: "ticket.status_changed",
      actor,
      data: { from, to: resolved.to, requested: to, redirected: resolved.redirected, summary: resolved.summary },
    });

    return {
      deliveryId,
      ticket: updated,
      from,
      redirected: resolved.redirected,
      reason: resolved.reason,
      clientName: ticket.client.name,
    };
  });

  waitUntil(deliverMany([result.deliveryId]));
  waitUntil(
    mirrorStatusChanged(
      {
        id: result.ticket.id,
        reference: result.ticket.reference,
        title: result.ticket.title,
        status: result.ticket.status,
        type: result.ticket.type,
        priority: result.ticket.priority,
        clientName: result.clientName,
      },
      result.from,
      result.ticket.status
    )
  );
  return result;
}

export async function addTicketMessage(
  ticketId: string,
  actor: TicketActor,
  input: { body: string; visibility?: "PUBLIC" | "INTERNAL" }
) {
  const body = input.body.trim();
  if (!body) throw new TicketError("Message body is required", "INVALID");
  const visibility = input.visibility ?? "PUBLIC";
  if (actor.type === "CLIENT" && visibility === "INTERNAL") {
    throw new TicketError("Clients cannot post internal messages", "FORBIDDEN");
  }

  const { message, deliveryId } = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new TicketError("Ticket not found", "NOT_FOUND");
    const message = await tx.ticketMessage.create({
      data: {
        ticketId,
        authorType: actor.type,
        authorName: actor.name ?? null,
        body: withAiDisclosure(redactString(body), actor.type, visibility),
        visibility,
      },
    });
    await appendEvent(tx, {
      ticketId,
      kind: "message.added",
      actor,
      payload: { messageId: message.id, visibility },
    });
    // Internal notes never leave the CRM, so no webhook and no body in any payload.
    const deliveryId =
      visibility === "PUBLIC"
        ? await enqueueTicketWebhook(tx, {
            ticket,
            event: "ticket.message_added",
            actor,
            data: { messageId: message.id, authorType: message.authorType, visibility, body: message.body },
          })
        : null;
    return { message, deliveryId };
  });
  waitUntil(deliverMany([deliveryId]));
  return message;
}

export type UpdateTicketFields = {
  title?: string;
  description?: string;
  type?: Prisma.TicketUpdateInput["type"];
  priority?: Prisma.TicketUpdateInput["priority"];
  assigneeType?: Prisma.TicketUpdateInput["assigneeType"];
  assigneeId?: string | null;
  agentEligible?: boolean;
  statusSummary?: string | null;
  shareTechnicalDetails?: boolean;
};

/** Edits everything except status. Logs which fields changed (not their values, for free text). */
export async function updateTicketFields(
  ticketId: string,
  fields: UpdateTicketFields,
  actor: TicketActor
) {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.ticket.findUnique({ where: { id: ticketId } });
    if (!existing) throw new TicketError("Ticket not found", "NOT_FOUND");

    const data: Prisma.TicketUpdateInput = {};
    const changed: string[] = [];
    const set = <K extends keyof UpdateTicketFields>(key: K, value: unknown) => {
      if (value === undefined) return;
      (data as Record<string, unknown>)[key] = value;
      changed.push(key);
    };
    set("title", fields.title?.trim() ? redactString(fields.title.trim()) : undefined);
    set(
      "description",
      fields.description?.trim() ? redactString(fields.description.trim()) : undefined
    );
    set("type", fields.type);
    set("priority", fields.priority);
    set("assigneeType", fields.assigneeType);
    set("assigneeId", fields.assigneeId);
    set("agentEligible", fields.agentEligible);
    set(
      "statusSummary",
      fields.statusSummary === undefined
        ? undefined
        : fields.statusSummary
          ? redactString(fields.statusSummary.trim())
          : null
    );
    set("shareTechnicalDetails", fields.shareTechnicalDetails);

    if (changed.length === 0) return { updated: existing, deliveryId: null };

    const updated = await tx.ticket.update({ where: { id: ticketId }, data });
    await appendEvent(tx, {
      ticketId,
      kind: "ticket.updated",
      actor,
      payload: { fields: changed },
    });
    const assignmentChanged =
      updated.assigneeType !== existing.assigneeType || updated.assigneeId !== existing.assigneeId;
    const deliveryId = assignmentChanged
      ? await enqueueTicketWebhook(tx, {
          ticket: updated,
          event: "ticket.assigned",
          actor,
          data: { assigneeType: updated.assigneeType, assigneeId: updated.assigneeId },
        })
      : null;
    return { updated, deliveryId };
  });
  waitUntil(deliverMany([result.deliveryId]));
  return result.updated;
}
