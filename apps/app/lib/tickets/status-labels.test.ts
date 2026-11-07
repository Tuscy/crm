import { describe, expect, it } from "vitest";
import { clientStatusLabel, toClientView } from "./status-labels";
import { TICKET_STATUSES } from "./transitions";

describe("client labels", () => {
  it("covers every status", () => {
    for (const s of TICKET_STATUSES) expect(clientStatusLabel(s)).toBeTruthy();
  });

  it("shows NEEDS_HUMAN as Being looked at", () => {
    expect(clientStatusLabel("NEEDS_HUMAN")).toBe("Being looked at");
  });
});

describe("toClientView", () => {
  const base = {
    reference: "TKT-0001",
    title: "Form broken",
    statusSummary: "Fixing the form email",
    finalMessage: "All sorted.",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };

  it("hides the final message until the ticket is done", () => {
    expect(toClientView({ ...base, status: "IN_PROGRESS" }).finalMessage).toBeNull();
    expect(toClientView({ ...base, status: "AWAITING_REVIEW" }).finalMessage).toBeNull();
    expect(toClientView({ ...base, status: "RESOLVED" }).finalMessage).toBe("All sorted.");
  });

  it("never exposes internal fields", () => {
    const view = toClientView({ ...base, status: "NEW" });
    expect(Object.keys(view).sort()).toEqual(
      ["createdAt", "finalMessage", "reference", "statusLabel", "statusSummary", "title", "updatedAt"].sort()
    );
  });
});
