import { describe, expect, it } from "vitest";
import crypto from "crypto";
import { BACKOFF_SECONDS, MAX_ATTEMPTS, nextBackoffSeconds, signBody } from "./ticket-dispatch";

describe("nextBackoffSeconds", () => {
  it("follows 1m, 5m, 30m, 2h then gives up", () => {
    expect(nextBackoffSeconds(1)).toBe(60);
    expect(nextBackoffSeconds(2)).toBe(300);
    expect(nextBackoffSeconds(3)).toBe(1800);
    expect(nextBackoffSeconds(4)).toBe(7200);
    expect(nextBackoffSeconds(5)).toBeNull();
    expect(MAX_ATTEMPTS).toBe(BACKOFF_SECONDS.length + 1);
  });
});

describe("signBody", () => {
  it("matches the sha256= HMAC receivers verify", () => {
    const body = JSON.stringify({ a: 1 });
    const expected = "sha256=" + crypto.createHmac("sha256", "s3cret").update(body).digest("hex");
    expect(signBody("s3cret", body)).toBe(expected);
  });

  it("changes when the body or secret changes", () => {
    expect(signBody("a", "x")).not.toBe(signBody("a", "y"));
    expect(signBody("a", "x")).not.toBe(signBody("b", "x"));
  });
});
