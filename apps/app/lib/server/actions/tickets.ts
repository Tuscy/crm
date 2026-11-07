"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@stky/db";
import type { Prisma } from "@stky/db";
import { requirePermission, toActor } from "@/lib/server/guard";
import {
  TicketError,
  addTicketMessage,
  createTicket,
  transitionTicket,
  updateTicketFields,
  type TicketActor,
} from "@/lib/tickets/events";
import {
  TICKET_PRIORITIES,
  TICKET_TYPES,
  oneOf,
} from "@/lib/tickets/api";
import { TICKET_STATUSES, type TicketStatusName } from "@/lib/tickets/transitions";

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof TicketError) return { ok: false, error: error.message };
  if (error instanceof Error && (error.message === "Forbidden" || error.message === "Unauthorized")) {
    return { ok: false, error: error.message === "Forbidden" ? "You don't have permission to do that" : "Please sign in again" };
  }
  console.error("ticket action failed:", error);
  return { ok: false, error: "Something went wrong" };
}

function staffActor(user: Awaited<ReturnType<typeof requirePermission>>): TicketActor {
  return { type: "STAFF", name: toActor(user)?.email ?? null };
}

function refresh(ticketId?: string, clientId?: string) {
  revalidatePath("/dashboard/tickets");
  if (ticketId) revalidatePath(`/dashboard/tickets/${ticketId}`);
  if (clientId) revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function listTickets(opts?: { clientId?: string; status?: string; take?: number }) {
  await requirePermission("ticket:read", { entity: "Ticket" });
  const where: Prisma.TicketWhereInput = {
    ...(opts?.clientId ? { clientId: opts.clientId } : {}),
    ...(opts?.status && (TICKET_STATUSES as readonly string[]).includes(opts.status)
      ? { status: opts.status as TicketStatusName }
      : {}),
  };
  return prisma.ticket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(opts?.take ?? 100, 300),
    include: { client: { select: { id: true, name: true } } },
  });
}

export async function getTicketDetail(id: string) {
  await requirePermission("ticket:read", { entity: "Ticket", entityId: id });
  return prisma.ticket.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      site: { select: { id: true, slug: true, customDomain: true, subdomain: true } },
      messages: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { seq: "asc" } },
    },
  });
}

export async function createTicketAction(input: {
  clientId: string;
  siteId?: string;
  title: string;
  description: string;
  type?: string;
  priority?: string;
  requesterName?: string;
  requesterEmail?: string;
}): Promise<Result<{ id: string; reference: string }>> {
  try {
    const user = await requirePermission("ticket:create", { entity: "Ticket" });
    const ticket = await createTicket(
      {
        clientId: input.clientId,
        siteId: input.siteId || null,
        title: input.title,
        description: input.description,
        type: oneOf(TICKET_TYPES, input.type),
        priority: oneOf(TICKET_PRIORITIES, input.priority),
        source: "CRM",
        requesterType: "STAFF",
        requesterName: input.requesterName ?? null,
        requesterEmail: input.requesterEmail ?? null,
      },
      staffActor(user)
    );
    refresh(ticket.id, ticket.clientId);
    return { ok: true, id: ticket.id, reference: ticket.reference };
  } catch (error) {
    return fail(error);
  }
}

export async function changeTicketStatusAction(input: {
  id: string;
  to: string;
  summary?: string;
  finalMessage?: string;
}): Promise<Result<{ redirected: boolean; reason?: string }>> {
  try {
    const user = await requirePermission("ticket:update", { entity: "Ticket", entityId: input.id });
    const to = oneOf(TICKET_STATUSES, input.to);
    if (!to) return { ok: false, error: "Unknown status" };
    const result = await transitionTicket(input.id, to, staffActor(user), {
      summary: input.summary,
      finalMessage: input.finalMessage,
    });
    refresh(input.id, result.ticket.clientId);
    return { ok: true, redirected: result.redirected, reason: result.reason };
  } catch (error) {
    return fail(error);
  }
}

export async function addTicketMessageAction(input: {
  id: string;
  body: string;
  visibility: "PUBLIC" | "INTERNAL";
}): Promise<Result> {
  try {
    const user = await requirePermission("ticket:update", { entity: "Ticket", entityId: input.id });
    await addTicketMessage(input.id, staffActor(user), {
      body: input.body,
      visibility: input.visibility,
    });
    refresh(input.id);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateTicketAction(input: {
  id: string;
  type?: string;
  priority?: string;
  assigneeType?: "NONE" | "HUMAN" | "AGENT";
  assigneeId?: string | null;
  agentEligible?: boolean;
  statusSummary?: string | null;
  shareTechnicalDetails?: boolean;
}): Promise<Result> {
  try {
    const user = await requirePermission("ticket:update", { entity: "Ticket", entityId: input.id });
    await updateTicketFields(
      input.id,
      {
        type: oneOf(TICKET_TYPES, input.type),
        priority: oneOf(TICKET_PRIORITIES, input.priority),
        assigneeType: input.assigneeType,
        assigneeId: input.assigneeId,
        agentEligible: input.agentEligible,
        statusSummary: input.statusSummary,
        shareTechnicalDetails: input.shareTechnicalDetails,
      },
      staffActor(user)
    );
    refresh(input.id);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
