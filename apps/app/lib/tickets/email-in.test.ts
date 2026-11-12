import { describe, expect, it } from "vitest";
import { extractReference, normaliseEmail, stripQuotedReply } from "./email-in";

describe("extractReference", () => {
  it("finds and normalises references", () => {
    expect(extractReference("Re: [TKT-0042] Form broken")).toBe("TKT-0042");
    expect(extractReference("re tkt-7")).toBe("TKT-0007");
    expect(extractReference("No reference here")).toBeNull();
  });
});

describe("stripQuotedReply", () => {
  it("removes quoted history", () => {
    const text = "Thanks, that works now.\n\nOn Mon, 3 Nov 2026 at 10:00, StickySites wrote:\n> We fixed it\n> Anything else?";
    expect(stripQuotedReply(text)).toBe("Thanks, that works now.");
  });

  it("drops > lines but keeps the rest", () => {
    expect(stripQuotedReply("Line one\n> quoted\nLine two")).toBe("Line one\nLine two");
  });
});

describe("normaliseEmail", () => {
  it("lowercases valid addresses and rejects junk", () => {
    expect(normaliseEmail(" Jo@Example.COM ")).toBe("jo@example.com");
    expect(normaliseEmail("not-an-email")).toBeNull();
    expect(normaliseEmail(42)).toBeNull();
  });
});
