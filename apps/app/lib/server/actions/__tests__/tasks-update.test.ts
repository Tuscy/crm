import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@stky/db", () => ({
  prisma: {
    task: {
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

import { prisma } from "@stky/db";
import { updateTask } from "../tasks";

const mockPrisma = prisma as unknown as {
  task: { update: ReturnType<typeof vi.fn> };
};

describe("updateTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates task title, dueDate, and notes", async () => {
    const dueDate = new Date("2026-12-01");
    mockPrisma.task.update.mockResolvedValue({
      id: "tsk-1",
      title: "Updated title",
      dueDate,
      notes: "Updated notes",
      leadId: null,
      completed: false,
      assigneeId: "usr-1",
      createdAt: new Date(),
    });

    const result = await updateTask("tsk-1", {
      title: "Updated title",
      dueDate,
      notes: "Updated notes",
    });

    expect(mockPrisma.task.update).toHaveBeenCalledWith({
      where: { id: "tsk-1" },
      data: {
        title: "Updated title",
        dueDate,
        notes: "Updated notes",
      },
    });
    expect(result.title).toBe("Updated title");
  });

  it("trims empty notes to null", async () => {
    mockPrisma.task.update.mockResolvedValue({
      id: "tsk-2",
      title: "Test",
      dueDate: null,
      notes: null,
      leadId: null,
      completed: false,
      assigneeId: "usr-1",
      createdAt: new Date(),
    });

    await updateTask("tsk-2", { title: "Test", notes: "   " });

    expect(mockPrisma.task.update).toHaveBeenCalledWith({
      where: { id: "tsk-2" },
      data: {
        title: "Test",
        dueDate: undefined,
        notes: null,
      },
    });
  });

  it("handles null dueDate", async () => {
    mockPrisma.task.update.mockResolvedValue({
      id: "tsk-3",
      title: "Test",
      dueDate: null,
      notes: null,
      leadId: null,
      completed: false,
      assigneeId: "usr-1",
      createdAt: new Date(),
    });

    await updateTask("tsk-3", { title: "Test", dueDate: null });

    expect(mockPrisma.task.update).toHaveBeenCalledWith({
      where: { id: "tsk-3" },
      data: {
        title: "Test",
        dueDate: null,
        notes: null,
      },
    });
  });
});
