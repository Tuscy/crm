import { describe, expect, it, vi } from "vitest";

vi.mock("@stky/db", () => ({ prisma: {}, Prisma: { DbNull: Symbol("DbNull") } }));
vi.mock("@/lib/server/audit", () => ({ audit: async () => {} }));

import { retentionCutoff } from "./retention";

describe("retentionCutoff", () => {
  it("is twelve months before now", () => {
    expect(retentionCutoff(new Date("2026-11-07T12:00:00Z")).toISOString()).toBe("2025-11-07T12:00:00.000Z");
  });

  it("handles year boundaries", () => {
    expect(retentionCutoff(new Date("2027-01-15T00:00:00Z")).toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("respects a custom number of months", () => {
    expect(retentionCutoff(new Date("2026-11-07T00:00:00Z"), 6).toISOString()).toBe("2026-05-07T00:00:00.000Z");
  });
});
