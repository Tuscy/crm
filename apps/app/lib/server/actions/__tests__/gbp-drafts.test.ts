import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

vi.mock("@stky/db", () => ({
  prisma: {
    gBPDraft: {
      create: vi.fn(),
      update: vi.fn(),
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

import { updateGBPDraft, approveGBPDraft, mockPostGBPDraft } from "../gbp-drafts";
import { prisma } from "@stky/db";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/server/guard";

const mockPrisma = prisma as unknown as {
  gBPDraft: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  activityLog: { create: ReturnType<typeof vi.fn> };
};

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockRequirePermission = requirePermission as unknown as ReturnType<typeof vi.fn>;

describe("GBP Draft Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1", isStaff: true } });
    mockRequirePermission.mockResolvedValue(undefined);
  });

  describe("Approval invalidation on edit", () => {
    it("should invalidate approval when editing approved draft", async () => {
      const originalContent = "Original post content";
      const editedContent = "Edited post content";

      mockPrisma.gBPDraft.findUnique.mockResolvedValue({
        id: "draft-1",
        content: originalContent,
        status: "APPROVED",
        approvedById: "user-2",
        approvedAt: new Date("2026-11-01"),
        contentHash: crypto
          .createHash("sha256")
          .update(originalContent.trim())
          .digest("hex"),
      });

      mockPrisma.gBPDraft.update.mockResolvedValue({
        id: "draft-1",
        content: editedContent,
        status: "DRAFT",
        approvedById: null,
        approvedAt: null,
        contentHash: null,
      });

      const result = await updateGBPDraft("draft-1", editedContent);

      expect(result.approvalInvalidated).toBe(true);
      expect(mockPrisma.gBPDraft.update).toHaveBeenCalledWith({
        where: { id: "draft-1" },
        data: expect.objectContaining({
          content: editedContent.trim(),
          status: "DRAFT",
          approvedById: null,
          approvedAt: null,
          contentHash: null,
        }),
      });
    });

    it("should not invalidate when editing draft (not yet approved)", async () => {
      mockPrisma.gBPDraft.findUnique.mockResolvedValue({
        id: "draft-2",
        content: "Draft content",
        status: "DRAFT",
        approvedById: null,
        approvedAt: null,
        contentHash: null,
      });

      mockPrisma.gBPDraft.update.mockResolvedValue({
        id: "draft-2",
        content: "Edited draft",
        status: "DRAFT",
      });

      const result = await updateGBPDraft("draft-2", "Edited draft");

      expect(result.approvalInvalidated).toBe(false);
    });
  });

  describe("Approval with content hash", () => {
    it("should store content hash when approving", async () => {
      const content = "Post content for approval";
      const expectedHash = crypto
        .createHash("sha256")
        .update(content.trim())
        .digest("hex");

      mockPrisma.gBPDraft.findUnique.mockResolvedValue({
        id: "draft-3",
        content,
        status: "DRAFT",
      });

      mockPrisma.gBPDraft.update.mockResolvedValue({
        id: "draft-3",
        status: "APPROVED",
        approvedById: "user-1",
        approvedAt: new Date(),
        contentHash: expectedHash,
      });

      await approveGBPDraft("draft-3");

      expect(mockPrisma.gBPDraft.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "APPROVED",
            approvedById: "user-1",
            contentHash: expectedHash,
          }),
        })
      );
    });
  });

  describe("Mock posting with version verification", () => {
    it("should reject posting if content changed after approval", async () => {
      const originalContent = "Approved content";
      const changedContent = "Changed content";
      const originalHash = crypto
        .createHash("sha256")
        .update(originalContent.trim())
        .digest("hex");

      mockPrisma.gBPDraft.findUnique.mockResolvedValue({
        id: "draft-4",
        content: changedContent,
        status: "APPROVED",
        contentHash: originalHash,
        client: { id: "client-1", name: "Test Client" },
      });

      await expect(mockPostGBPDraft("draft-4")).rejects.toThrow(
        "Content changed since approval"
      );
    });

    it("should allow mock posting when content unchanged", async () => {
      const content = "Approved unchanged content";
      const contentHash = crypto
        .createHash("sha256")
        .update(content.trim())
        .digest("hex");

      mockPrisma.gBPDraft.findUnique.mockResolvedValue({
        id: "draft-5",
        content,
        status: "APPROVED",
        contentHash,
        client: { id: "client-1", name: "Test Client" },
      });

      mockPrisma.gBPDraft.update.mockResolvedValue({
        id: "draft-5",
        status: "POSTED_MOCK",
      });

      await mockPostGBPDraft("draft-5");

      expect(mockPrisma.gBPDraft.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "POSTED_MOCK" },
        })
      );
    });

    it("should reject posting non-approved drafts", async () => {
      mockPrisma.gBPDraft.findUnique.mockResolvedValue({
        id: "draft-6",
        content: "Draft content",
        status: "DRAFT",
        client: { id: "client-1", name: "Test Client" },
      });

      await expect(mockPostGBPDraft("draft-6")).rejects.toThrow(
        "Only APPROVED drafts can be posted"
      );
    });
  });

  describe("Permission enforcement", () => {
    it("should enforce permission for approval", async () => {
      mockRequirePermission.mockRejectedValue(
        new Error("Permission denied: gbp:create")
      );

      await expect(approveGBPDraft("draft-1")).rejects.toThrow(
        "Permission denied"
      );
    });

    it("should enforce permission for posting", async () => {
      mockRequirePermission.mockRejectedValue(
        new Error("Permission denied: gbp:create")
      );

      await expect(mockPostGBPDraft("draft-1")).rejects.toThrow(
        "Permission denied"
      );
    });
  });
});
