/**
 * Ticket status rules. Pure, so it can be unit tested and used anywhere.
 * Only transitionTicket() (lib/tickets/events.ts) writes Ticket.status, and it
 * always goes through resolveTransition().
 */
export const TICKET_STATUSES = [
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "AWAITING_REVIEW",
  "AWAITING_CLIENT",
  "NEEDS_HUMAN",
  "RESOLVED",
  "CLOSED",
] as const;

export type TicketStatusName = (typeof TICKET_STATUSES)[number];

const ALLOWED: Record<TicketStatusName, readonly TicketStatusName[]> = {
  NEW: ["TRIAGED", "IN_PROGRESS", "NEEDS_HUMAN", "CLOSED"],
  TRIAGED: ["IN_PROGRESS", "AWAITING_CLIENT", "NEEDS_HUMAN", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["TRIAGED", "AWAITING_REVIEW", "AWAITING_CLIENT", "NEEDS_HUMAN"],
  AWAITING_REVIEW: ["IN_PROGRESS", "NEEDS_HUMAN", "RESOLVED"],
  AWAITING_CLIENT: ["TRIAGED", "IN_PROGRESS", "NEEDS_HUMAN", "RESOLVED", "CLOSED"],
  NEEDS_HUMAN: [
    "TRIAGED",
    "IN_PROGRESS",
    "AWAITING_REVIEW",
    "AWAITING_CLIENT",
    "RESOLVED",
    "CLOSED",
  ],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: ["TRIAGED"], // reopen
};

/** Moving into one of these needs a clean summary and a final message. */
const NEEDS_COMPLETION: readonly TicketStatusName[] = ["AWAITING_REVIEW", "RESOLVED"];

export function canTransition(from: TicketStatusName, to: TicketStatusName): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function allowedTransitions(from: TicketStatusName): readonly TicketStatusName[] {
  return ALLOWED[from] ?? [];
}

export type TransitionInput = {
  from: TicketStatusName;
  to: TicketStatusName;
  /** Summary supplied with this request, if any. */
  summary?: string | null;
  finalMessage?: string | null;
  /** Values already stored on the ticket. */
  existingSummary?: string | null;
  existingFinalMessage?: string | null;
};

export type TransitionResult =
  | { ok: false; error: string }
  | {
      ok: true;
      to: TicketStatusName;
      summary: string | null;
      finalMessage: string | null;
      /** True when the request was turned into NEEDS_HUMAN. */
      redirected: boolean;
      reason?: string;
    };

function clean(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

export function resolveTransition(input: TransitionInput): TransitionResult {
  const { from, to } = input;
  if (!canTransition(from, to)) {
    return { ok: false, error: `Cannot move a ticket from ${from} to ${to}` };
  }

  const summary = clean(input.summary) ?? clean(input.existingSummary);
  const finalMessage = clean(input.finalMessage) ?? clean(input.existingFinalMessage);

  if (NEEDS_COMPLETION.includes(to) && (!summary || !finalMessage)) {
    // Completion contract: never close without { status, summary, final_message }.
    if (canTransition(from, "NEEDS_HUMAN")) {
      return {
        ok: true,
        to: "NEEDS_HUMAN",
        summary,
        finalMessage,
        redirected: true,
        reason: `Moving to ${to} needs both a summary and a final message`,
      };
    }
    return {
      ok: false,
      error: `Moving to ${to} needs both a summary and a final message`,
    };
  }

  return { ok: true, to, summary, finalMessage, redirected: false };
}
