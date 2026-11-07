import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stky/db";
import { requireTicketAuth } from "@/lib/api-auth";
import { ApiScope } from "@/lib/api-scopes";
import { RunCapError, startAgentRun } from "@/lib/tickets/runs";
import { actorFor, errorResponse, mayTouch, readJson, str, unauthorized } from "@/lib/tickets/api";

type Ctx = { params: Promise<{ id: string }> };

/** Starts an agent run, enforcing 2 runs per ticket and the daily run and spend caps (429 when hit). */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const caller = await requireTicketAuth(
    request,
    "POST /api/tickets/:id/runs",
    [ApiScope.TICKETS_AGENT, ApiScope.TICKETS_WRITE],
    "ticket:update"
  );
  if (!caller) return unauthorized();

  const body = (await readJson(request)) ?? {};
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, assigneeType: true, assigneeId: true },
    });
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (!mayTouch(caller, ticket)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const actor = actorFor(caller);
    // Agent keys run as themselves; orchestration keys (n8n) name the agent.
    const agentName =
      caller.kind === "key" && caller.scopes.includes("tickets:agent")
        ? (caller.name ?? "agent")
        : (str(body.agentName, 80) ?? "agent");
    const run = await startAgentRun(ticket.id, agentName, actor);
    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    if (error instanceof RunCapError) {
      return NextResponse.json({ error: error.message, capped: true }, { status: 429 });
    }
    return errorResponse(error, "POST /api/tickets/:id/runs");
  }
}
