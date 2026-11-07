import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stky/db";
import { requireTicketAuth } from "@/lib/api-auth";
import { ApiScope } from "@/lib/api-scopes";
import { appendEvent } from "@/lib/tickets/events";
import { actorFor, errorResponse, mayTouch, readJson, str, unauthorized } from "@/lib/tickets/api";

type Ctx = { params: { id: string } };

/** Agents append activity here. Kinds are forced under "agent." so the log can't be made to look like system events. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const caller = await requireTicketAuth(
    request,
    "POST /api/tickets/:id/events",
    [ApiScope.TICKETS_AGENT],
    "ticket:update"
  );
  if (!caller) return unauthorized();

  const body = await readJson(request);
  const kind = str(body?.kind, 80);
  if (!body || !kind) return NextResponse.json({ error: "kind is required" }, { status: 422 });

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      select: { id: true, assigneeType: true, assigneeId: true },
    });
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (!mayTouch(caller, ticket)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload =
      body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? (body.payload as Record<string, unknown>)
        : undefined;
    const event = await prisma.$transaction((tx) =>
      appendEvent(tx, {
        ticketId: ticket.id,
        kind: kind.startsWith("agent.") ? kind : `agent.${kind}`,
        actor: actorFor(caller),
        payload,
        runId: str(body.runId, 100) ?? null,
      })
    );
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return errorResponse(error, "POST /api/tickets/:id/events");
  }
}
