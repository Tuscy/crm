import { prisma } from "@stky/db";
import { transitionTicket } from "./events";

export const DEFAULT_STALL_MINUTES = 90;

export function isStalled(lastActivity: Date, now: Date, minutes = DEFAULT_STALL_MINUTES): boolean {
  return now.getTime() - lastActivity.getTime() > minutes * 60_000;
}

/**
 * A ticket assigned to an agent and IN_PROGRESS with no activity for a while means the agent
 * died without finishing. Move it to NEEDS_HUMAN rather than leave the client waiting.
 */
export async function escalateStalledTickets(now = new Date()) {
  const minutes = Number(process.env.AGENT_STALL_MINUTES) > 0 ? Number(process.env.AGENT_STALL_MINUTES) : DEFAULT_STALL_MINUTES;
  const candidates = await prisma.ticket.findMany({
    where: { status: "IN_PROGRESS", assigneeType: "AGENT" },
    select: { id: true, updatedAt: true, events: { orderBy: { seq: "desc" }, take: 1, select: { createdAt: true } } },
  });
  let escalated = 0;
  for (const t of candidates) {
    const last = t.events[0]?.createdAt ?? t.updatedAt;
    if (!isStalled(last, now, minutes)) continue;
    try {
      await transitionTicket(t.id, "NEEDS_HUMAN", { type: "SYSTEM", name: "watchdog" }, {
        summary: "The assistant didn't finish, so a person will pick this up.",
      });
      escalated += 1;
    } catch {
      // Already moved by someone else between the query and now.
    }
  }
  return { checked: candidates.length, escalated };
}
