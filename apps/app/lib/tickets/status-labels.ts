import type { TicketStatusName } from "./transitions";

/** What clients see. NEEDS_HUMAN deliberately shows as "Being looked at". */
export const CLIENT_STATUS_LABELS: Record<TicketStatusName, string> = {
  NEW: "Received",
  TRIAGED: "Being looked at",
  IN_PROGRESS: "Working on it",
  AWAITING_REVIEW: "Working on it",
  AWAITING_CLIENT: "Awaiting your reply",
  NEEDS_HUMAN: "Being looked at",
  RESOLVED: "Done",
  CLOSED: "Done",
};

/** Staff-facing labels. */
export const STAFF_STATUS_LABELS: Record<TicketStatusName, string> = {
  NEW: "New",
  TRIAGED: "Triaged",
  IN_PROGRESS: "In progress",
  AWAITING_REVIEW: "Awaiting review",
  AWAITING_CLIENT: "Awaiting client",
  NEEDS_HUMAN: "Needs human",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export function clientStatusLabel(status: TicketStatusName): string {
  return CLIENT_STATUS_LABELS[status];
}

/** The only ticket fields a client (or a site-form key) may ever read. */
export function toClientView(ticket: {
  reference: string;
  title: string;
  status: TicketStatusName;
  statusSummary: string | null;
  finalMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    reference: ticket.reference,
    title: ticket.title,
    statusLabel: clientStatusLabel(ticket.status),
    statusSummary: ticket.statusSummary,
    finalMessage:
      ticket.status === "RESOLVED" || ticket.status === "CLOSED"
        ? ticket.finalMessage
        : null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}
