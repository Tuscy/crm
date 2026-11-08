import { describe, it, expect } from "vitest";
import { deriveConnectionState } from "../connection-state-indicator";

describe("GA4 and GSC connection state logic", () => {
  it("GA4: not configured state", () => {
    const status = deriveConnectionState(true, false, null, false, null);
    expect(status.state).toBe("not_configured");
  });

  it("GA4: loading state", () => {
    const status = deriveConnectionState(false, true, null, false, null);
    expect(status.state).toBe("loading");
  });

  it("GA4: error state", () => {
    const status = deriveConnectionState(false, false, "API error", false, null);
    expect(status.state).toBe("failed");
    expect(status.error).toBe("API error");
  });

  it("GA4: connected no data", () => {
    const status = deriveConnectionState(false, false, null, false, new Date());
    expect(status.state).toBe("connected_no_data");
  });

  it("GA4: connected with data", () => {
    const status = deriveConnectionState(false, false, null, true, new Date());
    expect(status.state).toBe("connected_with_data");
    expect(status.lastRefresh).toBeDefined();
  });

  it("GSC: not configured state", () => {
    const status = deriveConnectionState(true, false, null, false, null);
    expect(status.state).toBe("not_configured");
  });

  it("GSC: connected no data", () => {
    const status = deriveConnectionState(false, false, null, false, new Date());
    expect(status.state).toBe("connected_no_data");
  });

  it("GSC: error state", () => {
    const status = deriveConnectionState(false, false, "API error", false, null);
    expect(status.state).toBe("failed");
    expect(status.error).toBe("API error");
  });

  it("GSC: connected with data", () => {
    const status = deriveConnectionState(false, false, null, true, new Date());
    expect(status.state).toBe("connected_with_data");
    expect(status.lastRefresh).toBeDefined();
  });
});
