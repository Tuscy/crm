import { describe, it, expect } from "vitest";
import { deriveConnectionState } from "../connection-state-indicator";

describe("Connection State Indicator", () => {
  describe("deriveConnectionState", () => {
    it("should return not_configured when notConfigured is true", () => {
      const result = deriveConnectionState(true, false, null, false);
      expect(result.state).toBe("not_configured");
      expect(result.lastRefresh).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it("should return loading when loading is true", () => {
      const result = deriveConnectionState(false, true, null, false);
      expect(result.state).toBe("loading");
    });

    it("should return failed when error is present", () => {
      const error = "API connection timeout";
      const result = deriveConnectionState(false, false, error, false);
      expect(result.state).toBe("failed");
      expect(result.error).toBe(error);
    });

    it("should return connected_with_data when hasData is true", () => {
      const lastRefresh = new Date("2026-11-08T10:00:00Z");
      const result = deriveConnectionState(false, false, null, true, lastRefresh);
      expect(result.state).toBe("connected_with_data");
      expect(result.lastRefresh).toBe(lastRefresh);
    });

    it("should return connected_no_data when connected but no data", () => {
      const result = deriveConnectionState(false, false, null, false);
      expect(result.state).toBe("connected_no_data");
    });

    it("should prioritize notConfigured over other states", () => {
      const result = deriveConnectionState(true, true, "error", true);
      expect(result.state).toBe("not_configured");
    });

    it("should prioritize loading over error and data states", () => {
      const result = deriveConnectionState(false, true, "error", true);
      expect(result.state).toBe("loading");
    });

    it("should prioritize error over data states", () => {
      const result = deriveConnectionState(false, false, "error", true);
      expect(result.state).toBe("failed");
    });

    it("should not report blank result as failure", () => {
      // Empty data (no results in query) should be connected_no_data, not failed
      const result = deriveConnectionState(false, false, null, false);
      expect(result.state).toBe("connected_no_data");
      expect(result.state).not.toBe("failed");
    });

    it("should not report missing config as broken system", () => {
      // Not configured is a valid state, not an error
      const result = deriveConnectionState(true, false, null, false);
      expect(result.state).toBe("not_configured");
      expect(result.error).toBeUndefined();
    });

    it("should preserve lastRefresh only for connected_with_data state", () => {
      const lastRefresh = new Date("2026-11-08T10:00:00Z");
      
      const withData = deriveConnectionState(false, false, null, true, lastRefresh);
      expect(withData.lastRefresh).toBe(lastRefresh);
      
      const noData = deriveConnectionState(false, false, null, false, lastRefresh);
      expect(noData.lastRefresh).toBeUndefined();
    });
  });
});
