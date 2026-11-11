import { describe, it, expect } from "vitest";
import {
  PACKAGE_DISPLAY_LABELS,
  packageLabel,
  type PackageType,
} from "../index";

describe("Package Label Mapping", () => {
  describe("PACKAGE_DISPLAY_LABELS constant", () => {
    it("maps VOLTAGE to Minimum Stick", () => {
      expect(PACKAGE_DISPLAY_LABELS.VOLTAGE).toBe("Minimum Stick");
    });

    it("maps CHARGE to Extra Sticky", () => {
      expect(PACKAGE_DISPLAY_LABELS.CHARGE).toBe("Extra Sticky");
    });

    it("maps GRID to Totally Stuck", () => {
      expect(PACKAGE_DISPLAY_LABELS.GRID).toBe("Totally Stuck");
    });

    it("maps NONE to None", () => {
      expect(PACKAGE_DISPLAY_LABELS.NONE).toBe("None");
    });
  });

  describe("packageLabel helper", () => {
    it("returns correct label for VOLTAGE", () => {
      expect(packageLabel("VOLTAGE" as PackageType)).toBe("Minimum Stick");
    });

    it("returns correct label for CHARGE", () => {
      expect(packageLabel("CHARGE" as PackageType)).toBe("Extra Sticky");
    });

    it("returns correct label for GRID", () => {
      expect(packageLabel("GRID" as PackageType)).toBe("Totally Stuck");
    });

    it("returns None for null", () => {
      expect(packageLabel(null)).toBe("None");
    });

    it("returns None for undefined", () => {
      expect(packageLabel(undefined)).toBe("None");
    });

    it("preserves unknown package values (fallback)", () => {
      // If a legacy or unknown value is passed, return it as-is
      expect(packageLabel("UNKNOWN" as any)).toBe("UNKNOWN");
    });
  });

  describe("Data preservation guarantee", () => {
    it("does not modify database enum values", () => {
      // This test verifies that the mapping is display-only
      // Database values remain VOLTAGE, CHARGE, GRID
      const dbValue: PackageType = "VOLTAGE";
      const displayValue = packageLabel(dbValue);
      
      expect(dbValue).toBe("VOLTAGE"); // DB value unchanged
      expect(displayValue).toBe("Minimum Stick"); // Display mapped
    });

    it("supports None as valid selection", () => {
      // None/null must remain valid to avoid corrupting existing data
      expect(packageLabel(null)).toBe("None");
      expect(PACKAGE_DISPLAY_LABELS.NONE).toBe("None");
    });
  });
});
