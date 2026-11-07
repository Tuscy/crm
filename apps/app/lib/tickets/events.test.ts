import { describe, expect, it, vi } from "vitest";

// events.ts pulls in Prisma and Vercel helpers; only the pure helper is under test here.
vi.mock("@stky/db", () => ({ prisma: {} }));
vi.mock("@vercel/functions", () => ({ waitUntil: () => {} }));
vi.mock("@/lib/slack/ticket-mirror", () => ({}));
vi.mock("@/lib/webhooks/ticket-dispatch", () => ({}));

import { AI_DISCLOSURE, withAiDisclosure } from "./events";

describe("withAiDisclosure", () => {
  it("adds the disclosure to public agent messages once", () => {
    const once = withAiDisclosure("We're on it.", "AGENT", "PUBLIC");
    expect(once).toContain(AI_DISCLOSURE);
    expect(withAiDisclosure(once, "AGENT", "PUBLIC")).toBe(once);
  });

  it("leaves staff, client and internal messages alone", () => {
    expect(withAiDisclosure("hi", "STAFF", "PUBLIC")).toBe("hi");
    expect(withAiDisclosure("hi", "CLIENT", "PUBLIC")).toBe("hi");
    expect(withAiDisclosure("note", "AGENT", "INTERNAL")).toBe("note");
  });
});
