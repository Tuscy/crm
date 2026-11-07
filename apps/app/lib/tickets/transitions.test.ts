import { describe, expect, it } from "vitest";
import { canTransition, resolveTransition, TICKET_STATUSES } from "./transitions";

describe("canTransition", () => {
  it("allows the normal path", () => {
    expect(canTransition("NEW", "TRIAGED")).toBe(true);
    expect(canTransition("TRIAGED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "AWAITING_REVIEW")).toBe(true);
    expect(canTransition("AWAITING_REVIEW", "RESOLVED")).toBe(true);
    expect(canTransition("RESOLVED", "CLOSED")).toBe(true);
  });

  it("refuses skips and self-transitions", () => {
    expect(canTransition("NEW", "RESOLVED")).toBe(false);
    expect(canTransition("NEW", "AWAITING_REVIEW")).toBe(false);
    for (const s of TICKET_STATUSES) expect(canTransition(s, s)).toBe(false);
  });

  it("only allows reopening from CLOSED to TRIAGED", () => {
    expect(canTransition("CLOSED", "TRIAGED")).toBe(true);
    expect(canTransition("CLOSED", "IN_PROGRESS")).toBe(false);
  });
});

describe("resolveTransition completion contract", () => {
  it("redirects to NEEDS_HUMAN when summary or final message is missing", () => {
    const r = resolveTransition({ from: "IN_PROGRESS", to: "AWAITING_REVIEW" });
    expect(r).toMatchObject({ ok: true, to: "NEEDS_HUMAN", redirected: true });
  });

  it("redirects when only one of the two is supplied", () => {
    const r = resolveTransition({
      from: "IN_PROGRESS",
      to: "AWAITING_REVIEW",
      summary: "Fixed the form",
      finalMessage: "   ",
    });
    expect(r).toMatchObject({ ok: true, to: "NEEDS_HUMAN", redirected: true });
  });

  it("accepts the move when both are supplied", () => {
    const r = resolveTransition({
      from: "IN_PROGRESS",
      to: "AWAITING_REVIEW",
      summary: " Fixed the form ",
      finalMessage: "Your contact form emails you again.",
    });
    expect(r).toEqual({
      ok: true,
      to: "AWAITING_REVIEW",
      summary: "Fixed the form",
      finalMessage: "Your contact form emails you again.",
      redirected: false,
    });
  });

  it("counts values already stored on the ticket", () => {
    const r = resolveTransition({
      from: "AWAITING_REVIEW",
      to: "RESOLVED",
      existingSummary: "Done",
      existingFinalMessage: "All sorted.",
    });
    expect(r).toMatchObject({ ok: true, to: "RESOLVED", redirected: false });
  });

  it("errors, not redirects, when NEEDS_HUMAN is itself unreachable", () => {
    const r = resolveTransition({ from: "RESOLVED", to: "IN_PROGRESS" });
    expect(r).toMatchObject({ ok: true, to: "IN_PROGRESS" });
    const bad = resolveTransition({ from: "NEW", to: "RESOLVED" });
    expect(bad).toMatchObject({ ok: false });
  });

  it("refuses a disallowed transition outright", () => {
    expect(resolveTransition({ from: "CLOSED", to: "RESOLVED" })).toMatchObject({
      ok: false,
    });
  });
});
