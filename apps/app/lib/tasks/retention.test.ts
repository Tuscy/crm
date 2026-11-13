import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@stky/db", () => ({
  prisma: {
    task: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/observability", () => ({
  logStky: vi.fn(),
}));

import { prisma } from "@stky/db";
import { logStky } from "@/lib/observability";
import {
  daysAgoCutoff,
  isOlderCompletedTask,
  purgeOldCompletedTasks,
  selectCompletedTasksForPurge,
  TASK_COMPLETED_DELETE_AFTER_DAYS_DEFAULT,
  TASK_COMPLETED_HIDE_AFTER_DAYS_DEFAULT,
  taskCompletedDeleteAfterDays,
  taskCompletedHideAfterDays,
} from "./retention";

const mockPrisma = prisma as unknown as {
  task: { deleteMany: ReturnType<typeof vi.fn> };
};

describe("task retention helpers", () => {
  const now = new Date("2026-11-12T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TASK_COMPLETED_HIDE_AFTER_DAYS;
    delete process.env.TASK_COMPLETED_DELETE_AFTER_DAYS;
  });

  afterEach(() => {
    delete process.env.TASK_COMPLETED_HIDE_AFTER_DAYS;
    delete process.env.TASK_COMPLETED_DELETE_AFTER_DAYS;
  });

  it("uses 7 / 30 day defaults", () => {
    expect(taskCompletedHideAfterDays()).toBe(
      TASK_COMPLETED_HIDE_AFTER_DAYS_DEFAULT
    );
    expect(taskCompletedDeleteAfterDays()).toBe(
      TASK_COMPLETED_DELETE_AFTER_DAYS_DEFAULT
    );
  });

  it("reads env overrides when valid", () => {
    process.env.TASK_COMPLETED_HIDE_AFTER_DAYS = "14";
    process.env.TASK_COMPLETED_DELETE_AFTER_DAYS = "60";
    expect(taskCompletedHideAfterDays()).toBe(14);
    expect(taskCompletedDeleteAfterDays()).toBe(60);
  });

  it("ignores invalid env overrides", () => {
    process.env.TASK_COMPLETED_HIDE_AFTER_DAYS = "0";
    process.env.TASK_COMPLETED_DELETE_AFTER_DAYS = "nope";
    expect(taskCompletedHideAfterDays()).toBe(7);
    expect(taskCompletedDeleteAfterDays()).toBe(30);
  });

  it("computes day cutoffs", () => {
    expect(daysAgoCutoff(now, 7).toISOString()).toBe(
      "2026-11-05T12:00:00.000Z"
    );
    expect(daysAgoCutoff(now, 30).toISOString()).toBe(
      "2026-10-13T12:00:00.000Z"
    );
  });

  describe("isOlderCompletedTask", () => {
    it("returns false for open tasks", () => {
      expect(
        isOlderCompletedTask(
          { id: "a", completed: false, completedAt: null },
          7,
          now
        )
      ).toBe(false);
    });

    it("treats completed without completedAt as old", () => {
      expect(
        isOlderCompletedTask(
          { id: "a", completed: true, completedAt: null },
          7,
          now
        )
      ).toBe(true);
    });

    it("hides completed older than the hide window", () => {
      expect(
        isOlderCompletedTask(
          {
            id: "a",
            completed: true,
            completedAt: new Date("2026-11-01T12:00:00.000Z"),
          },
          7,
          now
        )
      ).toBe(true);
    });

    it("keeps recently completed visible", () => {
      expect(
        isOlderCompletedTask(
          {
            id: "a",
            completed: true,
            completedAt: new Date("2026-11-10T12:00:00.000Z"),
          },
          7,
          now
        )
      ).toBe(false);
    });
  });

  describe("selectCompletedTasksForPurge", () => {
    const tasks = [
      {
        id: "open",
        completed: false,
        completedAt: null,
      },
      {
        id: "recent",
        completed: true,
        completedAt: new Date("2026-11-01T12:00:00.000Z"),
      },
      {
        id: "old",
        completed: true,
        completedAt: new Date("2026-10-01T12:00:00.000Z"),
      },
      {
        id: "legacy",
        completed: true,
        completedAt: null,
      },
    ];

    it("selects only completed tasks past the delete threshold", () => {
      const selected = selectCompletedTasksForPurge(tasks, 30, now);
      expect(selected.map((t) => t.id)).toEqual(["old"]);
    });

    it("never selects open tasks even with an old completedAt", () => {
      const selected = selectCompletedTasksForPurge(
        [
          {
            id: "bad",
            completed: false,
            completedAt: new Date("2020-01-01T00:00:00.000Z"),
          },
        ],
        30,
        now
      );
      expect(selected).toEqual([]);
    });

    it("does not select completed tasks missing completedAt", () => {
      const selected = selectCompletedTasksForPurge(
        [{ id: "legacy", completed: true, completedAt: null }],
        30,
        now
      );
      expect(selected).toEqual([]);
    });
  });

  describe("purgeOldCompletedTasks", () => {
    it("deletes only completed tasks before the cutoff and logs the count", async () => {
      mockPrisma.task.deleteMany.mockResolvedValue({ count: 3 });

      const summary = await purgeOldCompletedTasks(now);

      expect(mockPrisma.task.deleteMany).toHaveBeenCalledWith({
        where: {
          completed: true,
          completedAt: { lt: daysAgoCutoff(now, 30) },
        },
      });
      expect(summary.deleted).toBe(3);
      expect(logStky).toHaveBeenCalledWith(
        "task_completed_purge",
        expect.objectContaining({ deleted: 3, deleteAfterDays: 30 })
      );
    });
  });
});
