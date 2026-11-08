import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma and auth
const mockPrisma = {
  lead: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
};

const mockAuth = vi.fn();
const mockRequirePermission = vi.fn();

vi.mock("@stky/db", () => ({ prisma: mockPrisma }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/server/guard", () => ({
  requirePermission: mockRequirePermission,
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Import after mocks
const { createLead, updateLead } = await import("../leads");

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
        phone: null,
        company: null,
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
        phone: null,
        company: null,
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
          phone: null,
          company: null,
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
