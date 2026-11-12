import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@stky/db", () => ({
  prisma: {
    task: {
      findUnique: vi.fn(),
      update: vi.fn(),
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

vi.mock("@/lib/email-flows/trigger", () => ({
  enrolMatchingFlows: vi.fn(),
}));

import { prisma } from "@stky/db";
import { enrolMatchingFlows } from "@/lib/email-flows/trigger";
import { toggleTaskCompleted } from "../tasks";

const mockPrisma = prisma as unknown as {
  task: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

describe("toggleTaskCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets completedAt when completing a task", async () => {
    mockPrisma.task.findUnique.mockResolvedValue({
      id: "tsk-1",
      completed: false,
      leadId: null,
    });
    mockPrisma.task.update.mockResolvedValue({
      id: "tsk-1",
      completed: true,
      completedAt: new Date("2026-11-12T12:00:00.000Z"),
      leadId: null,
    });

    await toggleTaskCompleted("tsk-1");

    expect(mockPrisma.task.update).toHaveBeenCalledWith({
      where: { id: "tsk-1" },
      data: {
        completed: true,
        completedAt: expect.any(Date),
      },
    });
    expect(enrolMatchingFlows).not.toHaveBeenCalled();
  });

  it("clears completedAt when reopening a task", async () => {
    mockPrisma.task.findUnique.mockResolvedValue({
      id: "tsk-2",
      completed: true,
      completedAt: new Date("2026-11-10"),
      leadId: "lead-1",
    });
    mockPrisma.task.update.mockResolvedValue({
      id: "tsk-2",
      completed: false,
      completedAt: null,
      leadId: "lead-1",
    });

    await toggleTaskCompleted("tsk-2");

    expect(mockPrisma.task.update).toHaveBeenCalledWith({
      where: { id: "tsk-2" },
      data: {
        completed: false,
        completedAt: null,
      },
    });
  });

  it("enrols TASK_COMPLETED flows only on false → true with a lead", async () => {
    mockPrisma.task.findUnique.mockResolvedValue({
      id: "tsk-3",
      completed: false,
      leadId: "lead-9",
    });
    mockPrisma.task.update.mockResolvedValue({
      id: "tsk-3",
      completed: true,
      completedAt: new Date(),
      leadId: "lead-9",
    });

    await toggleTaskCompleted("tsk-3");

    expect(enrolMatchingFlows).toHaveBeenCalledWith("TASK_COMPLETED", {
      leadId: "lead-9",
    });
  });
});
