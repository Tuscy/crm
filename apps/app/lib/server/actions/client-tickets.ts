"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentMembership } from "@stky/auth";
import { prisma } from "@stky/db";
import { isOverRateLimit } from "@stky/security";
import { TicketError, addTicketMessage, createTicket, transitionTicket } from "@/lib/tickets/events";
import { toClientView } from "@/lib/tickets/status-labels";
import { portalTicketView } from "@/lib/tickets/portal-view";
import type { TicketStatusName } from "@/lib/tickets/transitions";

/** Portal ticket actions. Every query is scoped to the signed-in membership's client. */

async function membership() {
  try {
    return await requireCurrentMembership();
  } catch {
    throw new TicketError("Please sign in again", "FORBIDDEN");
  }
}

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof TicketError) return { ok: false, error: error.message };
  console.error("portal ticket action failed:", error);
  return { ok: false, error: "Something went wrong" };
}

export async function listClientTickets() {
  const m = await membership();
  const tickets = await prisma.ticket.findMany({
    where: { clientId: m.clientId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return tickets.map((t) => ({ id: t.id, ...toClientView({ ...t, status: t.status as TicketStatusName }) }));
}

export async function getClientTicket(id: string) {
  const m = await membership();
  const ticket = await prisma.ticket.findFirst({ where: { id, clientId: m.clientId } });
  if (!ticket) return null;
  const [messages, events] = await Promise.all([
    prisma.ticketMessage.findMany({ where: { ticketId: id, visibility: "PUBLIC" }, orderBy: { createdAt: "asc" } }),
    // Only fetched when staff chose to share it; portalTicketView enforces this again.
    ticket.shareTechnicalDetails
      ? prisma.ticketEvent.findMany({ where: { ticketId: id }, orderBy: { seq: "asc" } })
      : Promise.resolve([]),
  ]);
  return portalTicketView({ ...ticket, status: ticket.status as TicketStatusName }, messages, events);
}

export async function createClientTicket(input: { title: string; description: string }): Promise<Result<{ id: string; reference: string }>> {
  try {
    const m = await membership();
    if (await isOverRateLimit(`portal:${m.id}`, "intake")) {
      return { ok: false, error: "You've sent a few already. Please try again in a little while." };
    }
    const ticket = await createTicket(
      {
        clientId: m.clientId,
        title: input.title,
        description: input.description,
        source: "PORTAL",
        requesterType: "CLIENT",
        requesterName: m.user.name ?? null,
        requesterEmail: m.user.email,
      },
      { type: "CLIENT", name: m.user.email }
    );
    revalidatePath("/client/tickets");
    revalidatePath("/dashboard/tickets");
    return { ok: true, id: ticket.id, reference: ticket.reference };
  } catch (error) {
    return fail(error);
  }
}

export async function replyToClientTicket(input: { id: string; body: string }): Promise<Result> {
  try {
    const m = await membership();
    const ticket = await prisma.ticket.findFirst({ where: { id: input.id, clientId: m.clientId }, select: { id: true, status: true } });
    if (!ticket) return { ok: false, error: "Ticket not found" };
    if (await isOverRateLimit(`portal-reply:${m.id}`, "intake")) {
      return { ok: false, error: "Please wait a moment before sending another message." };
    }
    const actor = { type: "CLIENT" as const, name: m.user.email };
    await addTicketMessage(ticket.id, actor, { body: input.body, visibility: "PUBLIC" });
    if (ticket.status === "AWAITING_CLIENT") {
      await transitionTicket(ticket.id, "TRIAGED", actor, { summary: "Thanks, we've got your reply." });
    }
    revalidatePath(`/client/tickets/${ticket.id}`);
    revalidatePath(`/dashboard/tickets/${ticket.id}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
