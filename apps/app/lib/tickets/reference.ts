import type { Prisma } from "@stky/db";

export function formatTicketReference(n: number): string {
  return `TKT-${String(n).padStart(4, "0")}`;
}

/**
 * Next global reference (TKT-0001, TKT-0002, ...). The increment is atomic in
 * Postgres, so call this inside the same transaction that creates the ticket.
 */
export async function nextTicketReference(tx: Prisma.TransactionClient): Promise<string> {
  const counter = await tx.ticketCounter.upsert({
    where: { id: 1 },
    create: { id: 1, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return formatTicketReference(counter.lastNumber);
}
