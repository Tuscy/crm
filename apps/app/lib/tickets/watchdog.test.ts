import { describe, expect, it, vi } from "vitest";

vi.mock("@stky/db", () => ({ prisma: {} }));
vi.mock("./events", () => ({ transitionTicket: async () => {} }));

import { isStalled } from "./watchdog";

describe("isStalled", () => {
  const now = new Date("2026-11-07T12:00:00Z");
  it("is false inside the window and true outside it", () => {
    expect(isStalled(new Date("2026-11-07T11:00:00Z"), now, 90)).toBe(false);
    expect(isStalled(new Date("2026-11-07T10:00:00Z"), now, 90)).toBe(true);
  });
});
