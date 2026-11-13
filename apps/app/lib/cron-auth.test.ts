import { describe, it, expect, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import { isCronAuthorised } from "./cron-auth";

function requestWithAuth(header: string | null): NextRequest {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "authorization" ? header : null,
    },
  } as unknown as NextRequest;
}

describe("isCronAuthorised", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("rejects when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    expect(isCronAuthorised(requestWithAuth("Bearer anything"))).toBe(false);
  });

  it("rejects missing bearer token", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(isCronAuthorised(requestWithAuth(null))).toBe(false);
  });

  it("accepts matching bearer token", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(isCronAuthorised(requestWithAuth("Bearer s3cret"))).toBe(true);
  });

  it("rejects wrong token", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(isCronAuthorised(requestWithAuth("Bearer nope"))).toBe(false);
  });
});
