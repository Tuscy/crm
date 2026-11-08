import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@stky/db", () => ({
  prisma: {
    lead: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/server/guard", () => ({
  requirePermission: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createLead, updateLead } from "../leads";
import { prisma } from "@stky/db";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/server/guard";

const mockPrisma = prisma as unknown as {
  lead: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  user: { findUnique: ReturnType<typeof vi.fn> };
  activityLog: { create: ReturnType<typeof vi.fn> };
};

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockRequirePermission = requirePermission as unknown as ReturnType<typeof vi.fn>;

describe("Lead Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1", isStaff: true } });
  });

  describe("createLead - follow-up validation", () => {
    it("should create lead with owner, nextAction, and followUpDate", async () => {
      mockRequirePermission.mockResolvedValue(undefined);
      mockPrisma.lead.create.mockResolvedValue({
        id: "lead-1",
        name: "Test Lead",
        email: "test@example.com",
        ownerId: "user-2",
        nextAction: "Send proposal",
        followUpDate: new Date("2026-11-15"),
      });

      const result = await createLead({
        name: "Test Lead",
        email: "test@example.com",
        phone: undefined,
        company: undefined,
        source: "REFERRAL",
        ownerId: "user-2",
        nextAction: "Send proposal",
        followUpDate: new Date("2026-11-15"),
      });

      expect(mockRequirePermission).toHaveBeenCalledWith("lead:create", {
        entity: "Lead",
      });
      expect(mockPrisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Test Lead",
            email: "test@example.com",
            ownerId: "user-2",
            nextAction: "Send proposal",
            followUpDate: expect.any(Date),
          }),
        })
      );
      expect(result).toHaveProperty("ownerId", "user-2");
      expect(result).toHaveProperty("nextAction", "Send proposal");
    });

    it("should allow null for optional follow-up fields", async () => {
      mockRequirePermission.mockResolvedValue(undefined);
      mockPrisma.lead.create.mockResolvedValue({
        id: "lead-2",
        name: "Test Lead 2",
        email: "test2@example.com",
        ownerId: null,
        nextAction: null,
        followUpDate: null,
      });

      const result = await createLead({
        name: "Test Lead 2",
        email: "test2@example.com",
        phone: undefined,
        company: undefined,
        source: "REFERRAL",
      });

      expect(mockPrisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            ownerId: expect.anything(),
            nextAction: expect.anything(),
            followUpDate: expect.anything(),
          }),
        })
      );
    });

    it("should enforce permission check", async () => {
      mockRequirePermission.mockRejectedValue(new Error("Permission denied"));

      await expect(
        createLead({
          name: "Test",
          email: "test@example.com",
          phone: undefined,
          company: undefined,
          source: "REFERRAL",
        })
      ).rejects.toThrow("Permission denied");
    });
  });

  describe("updateLead - follow-up updates", () => {
    it("should update follow-up fields", async () => {
      mockRequirePermission.mockResolvedValue(undefined);
      mockPrisma.lead.update.mockResolvedValue({
        id: "lead-1",
        nextAction: "Updated action",
        followUpDate: new Date("2026-12-01"),
      });

      const result = await updateLead("lead-1", {
        nextAction: "Updated action",
        followUpDate: new Date("2026-12-01"),
      });

      expect(mockRequirePermission).toHaveBeenCalledWith("lead:update", {
        entity: "Lead",
        entityId: "lead-1",
      });
      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "lead-1" },
          data: expect.objectContaining({
            nextAction: "Updated action",
            followUpDate: expect.any(Date),
          }),
        })
      );
    });

    it("should allow clearing follow-up fields", async () => {
      mockRequirePermission.mockResolvedValue(undefined);
      mockPrisma.lead.update.mockResolvedValue({
        id: "lead-1",
        nextAction: null,
        followUpDate: null,
      });

      await updateLead("lead-1", {
        nextAction: null,
        followUpDate: null,
      });

      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "lead-1" },
          data: expect.objectContaining({
            nextAction: null,
            followUpDate: null,
          }),
        })
      );
    });
  });
});
