import { describe, expect, it, vi } from "vitest";

vi.mock("@stky/db", () => ({ prisma: {} }));
vi.mock("@/lib/slack/ticket-mirror", () => ({ postTicketAlert: async () => {} }));
vi.mock("./events", () => ({ TicketError: class extends Error {} }));

import { checkRunCaps, MAX_RUNS_PER_TICKET } from "./runs";

const base = { runsForTicket: 0, runsToday: 0, spendToday: 0 };

describe("checkRunCaps", () => {
  it("allows a first run", () => {
    expect(checkRunCaps(base)).toEqual({ ok: true });
  });

  it("blocks a third run on one ticket", () => {
    expect(checkRunCaps({ ...base, runsForTicket: MAX_RUNS_PER_TICKET - 1 }).ok).toBe(true);
    expect(checkRunCaps({ ...base, runsForTicket: MAX_RUNS_PER_TICKET }).ok).toBe(false);
  });

  it("blocks at the daily run cap", () => {
    expect(checkRunCaps({ ...base, runsToday: 5, dailyRunCap: 5 }).ok).toBe(false);
    expect(checkRunCaps({ ...base, runsToday: 4, dailyRunCap: 5 }).ok).toBe(true);
  });

  it("blocks at the daily spend cap", () => {
    const r = checkRunCaps({ ...base, spendToday: 20 });
    expect(r.ok).toBe(false);
    expect(checkRunCaps({ ...base, spendToday: 19.99 }).ok).toBe(true);
    expect(checkRunCaps({ ...base, spendToday: 3, dailySpendCap: 3 }).ok).toBe(false);
  });
});
