import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stky/db";
import { requireTicketAuth } from "@/lib/api-auth";
import { ApiScope } from "@/lib/api-scopes";
import { finishAgentRun } from "@/lib/tickets/runs";
import { actorFor, errorResponse, mayTouch, oneOf, readJson, str, unauthorized } from "@/lib/tickets/api";

type Ctx = { params: Promise<{ id: string; runId: string }> };

function httpsUrl(value: unknown): string | null | undefined {
  const v = str(value, 2000);
  if (v === undefined) return undefined;
  try {
    return new URL(v).protocol === "https:" ? v : null;
  } catch {
    return null;
  }
}

/** Finishes a run with its outcome, PR and preview links and cost. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id, runId } = await params;
  const caller = await requireTicketAuth(
    request,
    "PATCH /api/tickets/:id/runs/:runId",
    [ApiScope.TICKETS_AGENT, ApiScope.TICKETS_WRITE],
    "ticket:update"
  );
  if (!caller) return unauthorized();

  const body = await readJson(request);
  const outcome = oneOf(["SUCCEEDED", "FAILED", "NEEDS_HUMAN"] as const, body?.outcome);
  if (!body || !outcome) return NextResponse.json({ error: "A valid outcome is required" }, { status: 422 });

  const prUrl = httpsUrl(body.prUrl);
  const previewUrl = httpsUrl(body.previewUrl);
  if (prUrl === null || previewUrl === null) {
    return NextResponse.json({ error: "prUrl and previewUrl must be https URLs" }, { status: 422 });
  }
  const cost = body.costEstimate === undefined ? undefined : Number(body.costEstimate);
  if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) {
    return NextResponse.json({ error: "costEstimate must be a non-negative number" }, { status: 422 });
  }

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, assigneeType: true, assigneeId: true },
    });
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (!mayTouch(caller, ticket)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const run = await finishAgentRun(
      ticket.id,
      runId,
      { outcome, prUrl, previewUrl, costEstimate: cost, rawLogRef: str(body.rawLogRef, 500) ?? null },
      actorFor(caller)
    );
    return NextResponse.json(run);
  } catch (error) {
    return errorResponse(error, "PATCH /api/tickets/:id/runs/:runId");
  }
}
