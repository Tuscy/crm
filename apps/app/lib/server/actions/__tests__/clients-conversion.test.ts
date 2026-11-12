import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@stky/db", () => ({
  prisma: {
    deal: {
      findUnique: vi.fn(),
    },
    lead: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    client: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
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

vi.mock("@/lib/server/activity-log", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@/lib/server/automation/flows", () => ({
  enrolMatchingFlows: vi.fn(),
}));

import { findOrCreateClientFromDeal } from "../clients";
import { prisma } from "@stky/db";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/server/guard";

const mockPrisma = prisma as unknown as {
  deal: { findUnique: ReturnType<typeof vi.fn> };
  lead: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  client: { findFirst: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
};

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockRequirePermission = requirePermission as unknown as ReturnType<typeof vi.fn>;

describe("findOrCreateClientFromDeal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "usr-test", email: "test@example.com", name: "Test User" },
    });
    mockRequirePermission.mockResolvedValue(undefined);
  });

  it("links existing client when email matches (case-insensitive)", async () => {
    const existingClient = {
      id: "cli-existing",
      name: "Existing Corp",
      primaryContactEmail: "contact@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const lead = {
      id: "lead-1",
      name: "Test Lead",
      email: "CONTACT@EXAMPLE.COM",
      phone: null,
      company: "Test Corp",
      clientId: null,
    };

    const deal = {
      id: "deal-1",
      leadId: "lead-1",
      lead,
    };

    mockPrisma.deal.findUnique.mockResolvedValue(deal);
    mockPrisma.client.findFirst.mockResolvedValue(existingClient);
    mockPrisma.lead.update.mockResolvedValue({ ...lead, clientId: existingClient.id });

    const result = await findOrCreateClientFromDeal("deal-1");

    expect(result).toBeDefined();
    expect(result?.id).toBe(existingClient.id);

    expect(mockPrisma.client.findFirst).toHaveBeenCalledWith({
      where: { primaryContactEmail: { equals: "contact@example.com", mode: "insensitive" } },
    });
  });

  it("creates new client when no email match exists", async () => {
    const lead = {
      id: "lead-2",
      name: "New Lead",
      email: "newlead@example.com",
      phone: "+44 20 1234 5678",
      company: "New Corp",
      clientId: null,
    };

    const deal = {
      id: "deal-2",
      leadId: "lead-2",
      lead,
      packageType: "standard",
    };

    const newClient = {
      id: "cli-new",
      name: "New Corp",
      primaryContactEmail: "newlead@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.deal.findUnique.mockResolvedValue(deal);
    mockPrisma.client.findFirst.mockResolvedValue(null);
    mockPrisma.client.create.mockResolvedValue(newClient);

    const result = await findOrCreateClientFromDeal("deal-2");

    expect(result).toBeDefined();
    expect(result?.id).toBe(newClient.id);

    expect(mockPrisma.client.create).toHaveBeenCalled();
  });

  it("throws when deal not found", async () => {
    mockPrisma.deal.findUnique.mockResolvedValue(null);

    await expect(findOrCreateClientFromDeal("deal-missing")).rejects.toThrow("not found");
  });

  it("returns existing client when lead already converted", async () => {
    const existingClient = {
      id: "cli-existing",
      name: "Existing Corp",
      primaryContactEmail: "converted@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const lead = {
      id: "lead-3",
      name: "Already Converted",
      email: "converted@example.com",
      phone: null,
      company: "Existing Corp",
      clientId: "cli-existing",
    };

    const deal = {
      id: "deal-3",
      leadId: "lead-3",
      lead,
    };

    mockPrisma.deal.findUnique.mockResolvedValue(deal);
    mockPrisma.client.findUnique.mockResolvedValue(existingClient);

    const result = await findOrCreateClientFromDeal("deal-3");

    expect(result?.id).toBe("cli-existing");
    expect(mockPrisma.client.findFirst).not.toHaveBeenCalled();
  });
});

/**
 * LIMITATION: Race condition between findFirst and create.
 *
 * If two concurrent requests call findOrCreateClientFromDeal with leads that have
 * the same primaryContactEmail, both might not find an existing client and attempt
 * to create duplicates. A UNIQUE constraint on primaryContactEmail would prevent
 * duplicate insertion (one request succeeds, the other fails with a unique violation).
 *
 * This test suite does not add that constraint because we cannot infer production-safe
 * schema migrations. The application currently handles this by attempting findFirst
 * before create, which is sufficient for non-concurrent usage but not guaranteed
 * under high concurrency.
 */
