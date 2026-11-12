import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stky/db";
import { requireTicketAuth } from "@/lib/api-auth";
import { ApiScope } from "@/lib/api-scopes";
import { updateTicketFields } from "@/lib/tickets/events";
import {
  TICKET_PRIORITIES,
  TICKET_TYPES,
  actorFor,
  errorResponse,
  isStaff,
  oneOf,
  readJson,
  str,
  unauthorized,
} from "@/lib/tickets/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const caller = await requireTicketAuth(
    request,
    "GET /api/tickets/:id",
    [ApiScope.TICKETS_READ],
    "ticket:read"
  );
  if (!caller) return unauthorized();

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { client: { select: { id: true, name: true } } },
    });
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    const full = isStaff(caller);
    const messages = await prisma.ticketMessage.findMany({
      where: { ticketId: ticket.id, ...(full ? {} : { visibility: "PUBLIC" }) },
      orderBy: { createdAt: "asc" },
    });

    // The activity log is for staff only, and only when asked for.
    const wantsLog = new URL(request.url).searchParams.get("include") === "log";
    const events =
      full && wantsLog
        ? await prisma.ticketEvent.findMany({ where: { ticketId: ticket.id }, orderBy: { seq: "asc" } })
        : undefined;

    return NextResponse.json({ ...ticket, messages, ...(events && { events }) });
  } catch (error) {
    return errorResponse(error, "GET /api/tickets/:id");
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const caller = await requireTicketAuth(
    request,
    "PATCH /api/tickets/:id",
    [ApiScope.TICKETS_WRITE],
    "ticket:update"
  );
  if (!caller) return unauthorized();

  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  if ("status" in body) {
    return NextResponse.json({ error: "Use POST /api/tickets/:id/status to change status" }, { status: 400 });
  }
  if ("shareTechnicalDetails" in body && caller.kind !== "staff") {
    return NextResponse.json({ error: "Only staff can change log sharing" }, { status: 403 });
  }

  try {
    const updated = await updateTicketFields(
      id,
      {
        title: str(body.title, 200),
        description: str(body.description),
        type: oneOf(TICKET_TYPES, body.type),
        priority: oneOf(TICKET_PRIORITIES, body.priority),
        assigneeType: oneOf(["NONE", "HUMAN", "AGENT"] as const, body.assigneeType),
        assigneeId: body.assigneeId === null ? null : str(body.assigneeId, 200),
        statusSummary: body.statusSummary === null ? null : str(body.statusSummary, 300),
        shareTechnicalDetails:
          typeof body.shareTechnicalDetails === "boolean" ? body.shareTechnicalDetails : undefined,
      },
      actorFor(caller)
    );
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error, "PATCH /api/tickets/:id");
  }
}
