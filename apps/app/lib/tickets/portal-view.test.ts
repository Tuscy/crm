import { describe, expect, it } from "vitest";
import { portalTicketView } from "./portal-view";

const ticket = {
  id: "t1",
  reference: "TKT-0001",
  title: "Form broken",
  status: "IN_PROGRESS" as const,
  statusSummary: "Looking into it",
  finalMessage: null,
  shareTechnicalDetails: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const messages = [
  { id: "m1", authorType: "STAFF", authorName: "rhyse@x.co", body: "Hello", visibility: "PUBLIC", createdAt: new Date(1) },
  { id: "m2", authorType: "STAFF", authorName: "rhyse@x.co", body: "secret internal note", visibility: "INTERNAL", createdAt: new Date(2) },
];
const events = [{ seq: 1, kind: "ticket.created", actorType: "CLIENT", createdAt: new Date(0), payload: { a: 1 } }];

describe("portalTicketView", () => {
  it("never includes internal messages", () => {
    const v = portalTicketView(ticket, messages, events);
    expect(v.messages).toHaveLength(1);
    expect(JSON.stringify(v)).not.toContain("secret internal note");
  });

  it("hides the activity log unless sharing is on", () => {
    expect(portalTicketView(ticket, messages, events).technicalLog).toBeNull();
    expect(portalTicketView({ ...ticket, shareTechnicalDetails: true }, messages, events).technicalLog).toHaveLength(1);
  });

  it("does not expose staff email addresses as author names", () => {
    const v = portalTicketView(ticket, messages, events);
    expect(v.messages[0].from).not.toContain("@");
  });
});
