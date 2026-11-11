import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@stky/db", () => ({
  prisma: {
    task: {
      findMany: vi.fn(),
    },
    deal: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { getTodayItems } from "../today";
import { prisma } from "@stky/db";
import { auth } from "@/auth";

const mockPrisma = prisma as unknown as {
  task: { findMany: ReturnType<typeof vi.fn> };
  deal: { findMany: ReturnType<typeof vi.fn> };
};

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

describe("getTodayItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "usr-test", email: "test@example.com" },
    });
  });

  it("returns overdue tasks", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    mockPrisma.task.findMany.mockResolvedValue([
      {
        id: "tsk-1",
        title: "Overdue task",
        dueDate: yesterday,
        completed: false,
        ownerId: "usr-test",
        assignee: { id: "usr-test", name: "Test User", email: "test@example.com" },
        lead: null,
        leadId: null,
      },
    ]);

    mockPrisma.deal.findMany.mockResolvedValue([]);

    const result = await getTodayItems();

    expect(result.overdueTasks.length).toBe(1);
    expect(result.overdueTasks[0]?.title).toBe("Overdue task");
  });

  it("returns tasks due today", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    mockPrisma.task.findMany.mockResolvedValue([
      {
        id: "tsk-2",
        title: "Task due today",
        dueDate: today,
        completed: false,
        ownerId: "usr-test",
        assignee: { id: "usr-test", name: "Test User", email: "test@example.com" },
        lead: null,
        leadId: null,
      },
    ]);

    mockPrisma.deal.findMany.mockResolvedValue([]);

    const result = await getTodayItems();

    expect(result.dueTodayTasks.length).toBe(1);
    expect(result.dueTodayTasks[0]?.title).toBe("Task due today");
  });

  it("returns upcoming tasks within 7 days", async () => {
    const upcoming = new Date();
    upcoming.setDate(upcoming.getDate() + 3);

    mockPrisma.task.findMany.mockResolvedValue([
      {
        id: "tsk-3",
        title: "Task in 3 days",
        dueDate: upcoming,
        completed: false,
        ownerId: "usr-test",
        assignee: { id: "usr-test", name: "Test User", email: "test@example.com" },
        lead: null,
        leadId: null,
      },
    ]);

    mockPrisma.deal.findMany.mockResolvedValue([]);

    const result = await getTodayItems();

    expect(result.upcomingTasks.length).toBe(1);
    expect(result.upcomingTasks[0]?.title).toBe("Task in 3 days");
  });

  it("returns active deals missing next action", async () => {
    mockPrisma.task.findMany.mockResolvedValue([]);

    mockPrisma.deal.findMany.mockResolvedValue([
      {
        id: "deal-1",
        stage: "proposal",
        value: 10000,
        leadId: "lead-1",
        lead: {
          id: "lead-1",
          name: "Test Lead",
          company: "Test Corp",
          nextAction: null,
        },
      },
    ]);

    const result = await getTodayItems();

    expect(result.dealsNeedingAction.length).toBe(1);
    expect(result.dealsNeedingAction[0]?.lead.name).toBe("Test Lead");
  });

  it("respects user scope", async () => {
    mockPrisma.task.findMany.mockResolvedValue([
      {
        id: "tsk-4",
        title: "My task",
        dueDate: new Date(),
        completed: false,
        ownerId: "usr-test",
        assignee: { id: "usr-test", name: "Test User", email: "test@example.com" },
        lead: null,
        leadId: null,
      },
    ]);

    mockPrisma.deal.findMany.mockResolvedValue([]);

    await getTodayItems();

    expect(mockPrisma.task.findMany).toHaveBeenCalled();
    const firstCall = mockPrisma.task.findMany.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]).toMatchObject({
      where: expect.objectContaining({
        OR: expect.arrayContaining([{ assigneeId: "usr-test" }]),
      }),
    });
  });

  it("excludes completed tasks", async () => {
    mockPrisma.task.findMany.mockResolvedValue([]);
    mockPrisma.deal.findMany.mockResolvedValue([]);

    await getTodayItems();

    const firstCall = mockPrisma.task.findMany.mock.calls[0];
    expect(firstCall?.[0]).toMatchObject({
      where: expect.objectContaining({
        completed: false,
      }),
    });
  });
});
