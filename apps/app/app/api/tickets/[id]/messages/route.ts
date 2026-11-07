import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stky/db";
import { requireTicketAuth } from "@/lib/api-auth";
import { ApiScope } from "@/lib/api-scopes";
import { addTicketMessage } from "@/lib/tickets/events";
import { actorFor, errorResponse, mayTouch, oneOf, readJson, str, unauthorized } from "@/lib/tickets/api";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const caller = await requireTicketAuth(
    request,
    "POST /api/tickets/:id/messages",
    [ApiScope.TICKETS_AGENT, ApiScope.TICKETS_WRITE],
    "ticket:update"
  );
  if (!caller) return unauthorized();

  const body = await readJson(request);
  const text = str(body?.body);
  if (!body || !text) return NextResponse.json({ error: "body is required" }, { status: 422 });

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: id },
      select: { id: true, assigneeType: true, assigneeId: true },
    });
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (!mayTouch(caller, ticket)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const message = await addTicketMessage(ticket.id, actorFor(caller), {
      body: text,
      visibility: oneOf(["PUBLIC", "INTERNAL"] as const, body.visibility) ?? "PUBLIC",
    });
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    return errorResponse(error, "POST /api/tickets/:id/messages");
  }
}
