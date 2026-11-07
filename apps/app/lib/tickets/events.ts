import { prisma } from "@stky/db";
import type { Prisma } from "@stky/db";
import { waitUntil } from "@vercel/functions";
import { redactString, redactValue } from "./redact";
import { nextTicketReference } from "./reference";
import {
  resolveTransition,
  type TicketStatusName,
} from "./transitions";
import { mirrorStatusChanged, mirrorTicketCreated } from "@/lib/slack/ticket-mirror";

/**
 * The only module that writes tickets. Every change appends a TicketEvent
 * (redacted) in the same transaction, and status changes go through
 * transitionTicket() so the transition table and completion contract always apply.
 */

export type TicketActor = {
  type: "CLIENT" | "STAFF" | "AGENT" | "SYSTEM";
  name?: string | null;
};

export class TicketError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "INVALID_TRANSITION" | "FORBIDDEN" | "INVALID"
  ) {
    super(message);
  }
}

type Tx = Prisma.TransactionClient;

/** Next per-ticket sequence number. Locks the ticket row so concurrent writers queue. */
async function nextSeq(tx: Tx, ticketId: string): Promise<number> {
  await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`;
  const last = await tx.ticketEvent.aggregate({
    where: { ticketId },
    _max: { seq: true },
  });
  return (last._max.seq ?? 0) + 1;
}

export async function appendEvent(
  tx: Tx,
  input: {
    ticketId: string;
    kind: string;
    actor: TicketActor;
    payload?: Record<string, unknown>;
    runId?: string | null;
  }
) {
  const seq = await nextSeq(tx, input.ticketId);
  return tx.ticketEvent.create({
    data: {
      ticketId: input.ticketId,
      runId: input.runId ?? null,
      seq,
      kind: input.kind,
      actorType: input.actor.type,
      actorName: input.actor.name ?? null,
      payload: input.payload
        ? (redactValue(input.payload) as Prisma.InputJsonValue)
        : undefined,
    },
  });
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

  const ticket = await prisma.$transaction(async (tx) => {
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
    return created;
  });

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

    return {
      ticket: updated,
      from,
      redirected: resolved.redirected,
      reason: resolved.reason,
      clientName: ticket.client.name,
    };
  });

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

  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!ticket) throw new TicketError("Ticket not found", "NOT_FOUND");
    const message = await tx.ticketMessage.create({
      data: {
        ticketId,
        authorType: actor.type,
        authorName: actor.name ?? null,
        body: redactString(body),
        visibility,
      },
    });
    await appendEvent(tx, {
      ticketId,
      kind: "message.added",
      actor,
      payload: { messageId: message.id, visibility },
    });
    return message;
  });
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
  return prisma.$transaction(async (tx) => {
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

    if (changed.length === 0) return existing;

    const updated = await tx.ticket.update({ where: { id: ticketId }, data });
    await appendEvent(tx, {
      ticketId,
      kind: "ticket.updated",
      actor,
      payload: { fields: changed },
    });
    return updated;
  });
}
