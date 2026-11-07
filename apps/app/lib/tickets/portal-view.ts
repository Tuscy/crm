import { toClientView } from "./status-labels";
import type { TicketStatusName } from "./transitions";

type PortalTicket = {
  id: string;
  reference: string;
  title: string;
  status: TicketStatusName;
  statusSummary: string | null;
  finalMessage: string | null;
  shareTechnicalDetails: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type PortalMessage = {
  id: string;
  authorType: string;
  authorName: string | null;
  body: string;
  visibility: string;
  createdAt: Date;
};

type PortalEvent = { seq: number; kind: string; actorType: string; createdAt: Date; payload: unknown };

/**
 * Everything a client may see about a ticket. Internal messages are always dropped.
 * The activity log is included only when staff switched on "share technical details".
 */
export function portalTicketView(ticket: PortalTicket, messages: PortalMessage[], events: PortalEvent[]) {
  return {
    id: ticket.id,
    ...toClientView(ticket),
    messages: messages
      .filter((m) => m.visibility === "PUBLIC")
      .map((m) => ({
        id: m.id,
        // Staff author names are email addresses; clients only ever see "StickySites".
        from: m.authorType === "CLIENT" ? "You" : "StickySites",
        body: m.body,
        createdAt: m.createdAt,
      })),
    technicalLog: ticket.shareTechnicalDetails
      ? events.map((e) => ({ seq: e.seq, kind: e.kind, actorType: e.actorType, createdAt: e.createdAt, payload: e.payload }))
      : null,
  };
}
