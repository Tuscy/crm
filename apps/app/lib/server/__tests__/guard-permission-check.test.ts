import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@stky/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/server/audit", () => ({
  audit: vi.fn(),
}));

import { prisma } from "@stky/db";
import { auth } from "@/auth";
import { currentStaffCan, requirePermission } from "../guard";

const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
};

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

describe("Guard permission checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("currentStaffCan (non-throwing)", () => {
    it("returns false when not signed in", async () => {
      mockAuth.mockResolvedValue(null);
      expect(await currentStaffCan("integration:read")).toBe(false);
    });

    it("returns false when user is not staff", async () => {
      mockAuth.mockResolvedValue({ user: { id: "usr-1", isStaff: false } });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr-1",
        isStaff: false,
        staffRole: null,
      });
      expect(await currentStaffCan("integration:read")).toBe(false);
    });

    it("returns false when editor lacks admin permission", async () => {
      mockAuth.mockResolvedValue({ user: { id: "usr-2", isStaff: true } });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr-2",
        email: "editor@example.com",
        isStaff: true,
        staffRole: "EDITOR",
      });
      expect(await currentStaffCan("integration:read")).toBe(false);
    });

    it("returns true when admin has permission", async () => {
      mockAuth.mockResolvedValue({ user: { id: "usr-3", isStaff: true } });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr-3",
        email: "admin@example.com",
        isStaff: true,
        staffRole: "ADMIN",
      });
      expect(await currentStaffCan("integration:read")).toBe(true);
    });

    it("returns true when editor has allowed permission", async () => {
      mockAuth.mockResolvedValue({ user: { id: "usr-4", isStaff: true } });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr-4",
        email: "editor@example.com",
        isStaff: true,
        staffRole: "EDITOR",
      });
      expect(await currentStaffCan("lead:read")).toBe(true);
    });
  });

  describe("requirePermission (throwing)", () => {
    it("throws Unauthorized when not signed in", async () => {
      mockAuth.mockResolvedValue(null);
      await expect(requirePermission("integration:read")).rejects.toThrow("Unauthorized");
    });

    it("throws Forbidden when editor lacks permission", async () => {
      mockAuth.mockResolvedValue({ user: { id: "usr-5", isStaff: true } });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr-5",
        email: "editor@example.com",
        isStaff: true,
        staffRole: "EDITOR",
      });
      await expect(requirePermission("integration:read")).rejects.toThrow("Forbidden");
    });

    it("returns user when admin has permission", async () => {
      mockAuth.mockResolvedValue({ user: { id: "usr-6", isStaff: true } });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr-6",
        email: "admin@example.com",
        isStaff: true,
        staffRole: "ADMIN",
      });
      const user = await requirePermission("integration:read");
      expect(user.id).toBe("usr-6");
      expect(user.role).toBe("ADMIN");
    });
  });
});
