import { prisma } from "@stky/db";
import { appendEvent, type TicketActor } from "./log";
import { TicketError } from "./events";
import { postTicketAlert } from "@/lib/slack/ticket-mirror";

/** Agent run bookkeeping and spend/run caps (spec FR-011). */
export const MAX_RUNS_PER_TICKET = 2;
export const DEFAULT_DAILY_RUN_CAP = 20;
export const DEFAULT_DAILY_SPEND_CAP_USD = 20;

export type CapInput = {
  runsForTicket: number;
  runsToday: number;
  spendToday: number;
  dailyRunCap?: number;
  dailySpendCap?: number;
};

export function checkRunCaps(input: CapInput): { ok: true } | { ok: false; reason: string } {
  const dailyRunCap = input.dailyRunCap ?? DEFAULT_DAILY_RUN_CAP;
  const dailySpendCap = input.dailySpendCap ?? DEFAULT_DAILY_SPEND_CAP_USD;
  if (input.runsForTicket >= MAX_RUNS_PER_TICKET) {
    return { ok: false, reason: `This ticket has already had ${MAX_RUNS_PER_TICKET} agent runs` };
  }
  if (input.runsToday >= dailyRunCap) {
    return { ok: false, reason: `Daily agent run cap of ${dailyRunCap} reached` };
  }
  if (input.spendToday >= dailySpendCap) {
    return { ok: false, reason: `Daily agent spend cap of $${dailySpendCap} reached` };
  }
  return { ok: true };
}

function envNumber(name: string): number | undefined {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

export class RunCapError extends Error {}

export async function startAgentRun(ticketId: string, agentName: string, actor: TicketActor) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  return prisma
    .$transaction(async (tx) => {
      // Locks the ticket row so two simultaneous starts can't both slip under the cap.
      await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`;
      const ticket = await tx.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
      if (!ticket) throw new TicketError("Ticket not found", "NOT_FOUND");

      const [runsForTicket, today] = await Promise.all([
        tx.agentRun.count({ where: { ticketId } }),
        tx.agentRun.aggregate({
          where: { startedAt: { gte: startOfDay } },
          _count: { _all: true },
          _sum: { costEstimate: true },
        }),
      ]);
      const caps = checkRunCaps({
        runsForTicket,
        runsToday: today._count._all,
        spendToday: Number(today._sum.costEstimate ?? 0),
        dailyRunCap: envNumber("AGENT_DAILY_RUN_CAP"),
        dailySpendCap: envNumber("AGENT_DAILY_SPEND_CAP_USD"),
      });
      if (!caps.ok) {
        await appendEvent(tx, {
          ticketId,
          kind: "agent.run_blocked",
          actor,
          payload: { agentName, reason: caps.reason },
        });
        throw new RunCapError(caps.reason);
      }

      const run = await tx.agentRun.create({ data: { ticketId, agentName } });
      await appendEvent(tx, {
        ticketId,
        runId: run.id,
        kind: "agent.run_started",
        actor,
        payload: { agentName, runNumber: runsForTicket + 1 },
      });
      return run;
    })
    .catch(async (error) => {
      if (error instanceof RunCapError) {
        await postTicketAlert(`:no_entry: Agent run blocked for ticket ${ticketId}: ${error.message}`);
      }
      throw error;
    });
}

export async function finishAgentRun(
  ticketId: string,
  runId: string,
  input: {
    outcome: "SUCCEEDED" | "FAILED" | "NEEDS_HUMAN";
    prUrl?: string | null;
    previewUrl?: string | null;
    costEstimate?: number | null;
    rawLogRef?: string | null;
  },
  actor: TicketActor
) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.agentRun.findUnique({ where: { id: runId } });
    if (!run || run.ticketId !== ticketId) throw new TicketError("Run not found", "NOT_FOUND");
    if (run.finishedAt) throw new TicketError("Run already finished", "INVALID");
    const updated = await tx.agentRun.update({
      where: { id: runId },
      data: {
        finishedAt: new Date(),
        outcome: input.outcome,
        prUrl: input.prUrl ?? null,
        previewUrl: input.previewUrl ?? null,
        costEstimate: input.costEstimate ?? null,
        rawLogRef: input.rawLogRef ?? null,
      },
    });
    await appendEvent(tx, {
      ticketId,
      runId,
      kind: "agent.run_finished",
      actor,
      payload: { outcome: input.outcome, prUrl: input.prUrl, previewUrl: input.previewUrl, costEstimate: input.costEstimate },
    });
    return updated;
  });
}
