import { describe, expect, it } from "vitest";
import { formatTicketReference } from "./reference";

describe("formatTicketReference", () => {
  it("pads to four digits and grows past them", () => {
    expect(formatTicketReference(1)).toBe("TKT-0001");
    expect(formatTicketReference(42)).toBe("TKT-0042");
    expect(formatTicketReference(12345)).toBe("TKT-12345");
  });
});
