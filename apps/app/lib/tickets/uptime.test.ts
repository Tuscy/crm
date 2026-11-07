import { describe, expect, it } from "vitest";
import { hostnameOf, parseUptimePayload } from "./uptime";

describe("hostnameOf", () => {
  it("normalises urls and hostnames", () => {
    expect(hostnameOf("https://www.Example.co.uk/path")).toBe("example.co.uk");
    expect(hostnameOf("example.com")).toBe("example.com");
    expect(hostnameOf(null)).toBeNull();
  });
});

describe("parseUptimePayload", () => {
  it("reads down and up alerts", () => {
    const down = parseUptimePayload({ heartbeat: { status: 0, msg: "timeout" }, monitor: { name: "Acme", url: "https://acme.co.uk" } });
    expect(down).toMatchObject({ status: "down", hostname: "acme.co.uk", message: "timeout" });
    expect(parseUptimePayload({ heartbeat: { status: 1 }, monitor: { name: "Acme", url: "https://acme.co.uk" } })?.status).toBe("up");
  });

  it("ignores pending, maintenance and junk", () => {
    expect(parseUptimePayload({ heartbeat: { status: 2 } })).toBeNull();
    expect(parseUptimePayload({ heartbeat: { status: 3 } })).toBeNull();
    expect(parseUptimePayload("nope")).toBeNull();
  });
});
