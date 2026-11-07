import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stky/db";
import { requireTicketAuth } from "@/lib/api-auth";
import { ApiScope } from "@/lib/api-scopes";
import { transitionTicket } from "@/lib/tickets/events";
import { TICKET_STATUSES } from "@/lib/tickets/transitions";
import { actorFor, errorResponse, mayTouch, oneOf, readJson, str, unauthorized } from "@/lib/tickets/api";

type Ctx = { params: { id: string } };

/**
 * Requests a status change. The CRM validates the transition; callers cannot set
 * arbitrary states. Moving to AWAITING_REVIEW or RESOLVED needs summary and final message,
 * otherwise the ticket goes to NEEDS_HUMAN (response has redirected: true).
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const caller = await requireTicketAuth(
    request,
    "POST /api/tickets/:id/status",
    [ApiScope.TICKETS_AGENT, ApiScope.TICKETS_WRITE],
    "ticket:update"
  );
  if (!caller) return unauthorized();

  const body = await readJson(request);
  const to = oneOf(TICKET_STATUSES, body?.to);
  if (!body || !to) return NextResponse.json({ error: "A valid 'to' status is required" }, { status: 422 });

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      select: { id: true, assigneeType: true, assigneeId: true },
    });
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (!mayTouch(caller, ticket)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const result = await transitionTicket(ticket.id, to, actorFor(caller), {
      summary: str(body.summary, 300),
      finalMessage: str(body.final_message ?? body.finalMessage),
      runId: str(body.runId, 100) ?? null,
    });
    return NextResponse.json({
      ticket: result.ticket,
      redirected: result.redirected,
      reason: result.reason,
    });
  } catch (error) {
    return errorResponse(error, "POST /api/tickets/:id/status");
  }
}
