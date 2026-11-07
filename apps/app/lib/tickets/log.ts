import type { Prisma } from "@stky/db";
import { redactValue } from "./redact";

export type TicketActor = {
  type: "CLIENT" | "STAFF" | "AGENT" | "SYSTEM";
  name?: string | null;
};

type Tx = Prisma.TransactionClient;

/** Next per-ticket sequence number. Locks the ticket row so concurrent writers queue. */
async function nextSeq(tx: Tx, ticketId: string): Promise<number> {
  await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`;
  const last = await tx.ticketEvent.aggregate({
    where: { ticketId },
    _max: { seq: true },
  });
  return (last._max.seq ?? 0) + 1;
}

export async function appendEvent(
  tx: Tx,
  input: {
    ticketId: string;
    kind: string;
    actor: TicketActor;
    payload?: Record<string, unknown>;
    runId?: string | null;
  }
) {
  const seq = await nextSeq(tx, input.ticketId);
  return tx.ticketEvent.create({
    data: {
      ticketId: input.ticketId,
      runId: input.runId ?? null,
      seq,
      kind: input.kind,
      actorType: input.actor.type,
      actorName: input.actor.name ?? null,
      payload: input.payload
        ? (redactValue(input.payload) as Prisma.InputJsonValue)
        : undefined,
    },
  });
}

