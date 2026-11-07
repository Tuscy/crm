import { prisma, Prisma } from "@stky/db";
import { audit } from "@/lib/server/audit";

/** Retention (spec decision 4, FR-014): raw agent output is purged after 12 months. */
export const RAW_RETENTION_MONTHS = 12;
/** Delivered and dead webhook payloads hold ticket text, so they go sooner. */
export const WEBHOOK_RETENTION_DAYS = 30;

export function retentionCutoff(now: Date, months = RAW_RETENTION_MONTHS): Date {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

/**
 * Hook for deleting the stored object behind AgentRun.rawLogRef once raw log storage is
 * chosen (spec open decision 2: Postgres now, an R2 pointer later). No-op until then.
 */
async function deleteStoredRawLog(_ref: string): Promise<void> {}

/**
 * Removes raw agent output older than the cutoff: inline `agent.*` event payloads and
 * AgentRun.rawLogRef. Summaries, final messages and the event rows themselves stay.
 * The payload update is the one UPDATE the TicketEvent trigger allows, and only inside
 * a transaction that sets stky.retention_purge (see the retention migration).
 */
export async function purgeRawAgentOutput(now = new Date()) {
  const cutoff = retentionCutoff(now);

  const runs = await prisma.agentRun.findMany({
    where: { startedAt: { lt: cutoff }, rawLogRef: { not: null } },
    select: { id: true, rawLogRef: true },
  });
  for (const run of runs) if (run.rawLogRef) await deleteStoredRawLog(run.rawLogRef);

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('stky.retention_purge', 'on', true)`;
    const events = await tx.ticketEvent.updateMany({
      where: { kind: { startsWith: "agent." }, createdAt: { lt: cutoff }, payload: { not: Prisma.DbNull } },
      data: { payload: Prisma.DbNull },
    });
    const cleared = await tx.agentRun.updateMany({
      where: { id: { in: runs.map((r) => r.id) } },
      data: { rawLogRef: null },
    });
    return { eventsPurged: events.count, runsCleared: cleared.count };
  });

  const webhooks = await prisma.webhookDelivery.deleteMany({
    where: {
      status: { in: ["DELIVERED", "DEAD"] },
      createdAt: { lt: new Date(now.getTime() - WEBHOOK_RETENTION_DAYS * 86_400_000) },
    },
  });

  const summary = { ...result, webhookDeliveriesDeleted: webhooks.count, cutoff: cutoff.toISOString() };
  await audit({ action: "ticket.retention_purge", entity: "Ticket", metadata: summary });
  return summary;
}
