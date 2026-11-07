import { describe, expect, it } from "vitest";
import { REDACTED, redactString, redactValue } from "./redact";

describe("redactString", () => {
  it("redacts bearer tokens", () => {
    expect(redactString("Authorization: Bearer abcdef1234567890xyz")).toContain(
      `Bearer ${REDACTED}`
    );
  });

  it("redacts StickySites and GitHub keys", () => {
    const out = redactString("key sk_live_0123456789abcdef and ghp_abcdefghijklmnopqrstuv");
    expect(out).not.toContain("0123456789abcdef");
    expect(out).not.toContain("ghp_abcdefghijklmnopqrstuv");
  });

  it("redacts password and token pairs", () => {
    expect(redactString("my password: hunter22 thanks")).toBe(`my password: ${REDACTED} thanks`);
    expect(redactString('api_key="abc12345"')).toContain(REDACTED);
    expect(redactString("token=zzzz9999&x=1")).toContain(REDACTED);
  });

  it("redacts long hex blobs", () => {
    expect(redactString("hash 0123456789abcdef0123456789abcdef0123")).toContain(REDACTED);
  });

  it("leaves ordinary text alone", () => {
    const text = "The contact form on the homepage no longer sends email.";
    expect(redactString(text)).toBe(text);
  });
});

describe("redactValue", () => {
  it("redacts nested strings and secret-looking keys", () => {
    const out = redactValue({
      note: "use Bearer abcdef1234567890xyz",
      headers: { authorization: "Bearer foo", accept: "json" },
      list: ["password=letmein1"],
      count: 3,
      empty: null,
    });
    expect(JSON.stringify(out)).not.toContain("abcdef1234567890xyz");
    expect(out.headers.authorization).toBe(REDACTED);
    expect(out.headers.accept).toBe("json");
    expect(out.list[0]).toContain(REDACTED);
    expect(out.count).toBe(3);
    expect(out.empty).toBeNull();
  });
});
