import { describe, expect, it } from "vitest";
import { scopeAllows, scopeAllowsStrict } from "./api-scopes";

describe("scopeAllowsStrict", () => {
  it("needs the exact scope", () => {
    expect(scopeAllowsStrict(["tickets:read"], "tickets:read")).toBe(true);
    expect(scopeAllowsStrict(["tickets:read"], "tickets:write")).toBe(false);
  });

  it("does not treat empty or wildcard scopes as ticket access", () => {
    expect(scopeAllowsStrict([], "tickets:read")).toBe(false);
    expect(scopeAllowsStrict(["*"], "tickets:read")).toBe(false);
    // the legacy helper still does, which is why tickets don't use it
    expect(scopeAllows([], "tickets:read")).toBe(true);
  });
});
