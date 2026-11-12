import { describe, it, expect } from "vitest";
import {
  compareCompletedTasks,
  compareOpenTasks,
  mergeServerTasksWithPending,
  partitionPersonalTasks,
} from "./list-helpers";

function task(
  partial: Partial<{
    id: string;
    completed: boolean;
    completedAt: Date | null;
    dueDate: Date | null;
    title: string;
  }> & { id: string }
) {
  return {
    title: partial.title ?? partial.id,
    completed: partial.completed ?? false,
    completedAt: partial.completedAt ?? null,
    dueDate: partial.dueDate ?? null,
    ...partial,
  };
}

describe("compareOpenTasks", () => {
  it("sorts by dueDate ascending with nulls last and id tie-break", () => {
    const a = task({ id: "b", dueDate: new Date("2026-11-10") });
    const b = task({ id: "a", dueDate: new Date("2026-11-10") });
    const c = task({ id: "c", dueDate: null });
    const d = task({ id: "d", dueDate: new Date("2026-11-09") });
    const sorted = [a, b, c, d].sort(compareOpenTasks);
    expect(sorted.map((t) => t.id)).toEqual(["d", "a", "b", "c"]);
  });
});

describe("compareCompletedTasks", () => {
  it("sorts by completedAt descending with id tie-break", () => {
    const a = task({
      id: "b",
      completed: true,
      completedAt: new Date("2026-11-10"),
    });
    const b = task({
      id: "a",
      completed: true,
      completedAt: new Date("2026-11-10"),
    });
    const c = task({
      id: "c",
      completed: true,
      completedAt: new Date("2026-11-11"),
    });
    const sorted = [a, b, c].sort(compareCompletedTasks);
    expect(sorted.map((t) => t.id)).toEqual(["c", "a", "b"]);
  });
});

describe("partitionPersonalTasks", () => {
  const now = new Date("2026-11-12T12:00:00.000Z");

  it("keeps open and recent completed; hides older completed by default", () => {
    const tasks = [
      task({ id: "open-1", dueDate: new Date("2026-11-13") }),
      task({
        id: "done-recent",
        completed: true,
        completedAt: new Date("2026-11-10"),
      }),
      task({
        id: "done-old",
        completed: true,
        completedAt: new Date("2026-11-01"),
      }),
    ];

    const result = partitionPersonalTasks(tasks, {
      showOlderCompleted: false,
      hideAfterDays: 7,
      now,
    });

    expect(result.open.map((t) => t.id)).toEqual(["open-1"]);
    expect(result.completed.map((t) => t.id)).toEqual(["done-recent"]);
    expect(result.hiddenOlderCount).toBe(1);
  });

  it("shows older completed when toggled on", () => {
    const tasks = [
      task({
        id: "done-old",
        completed: true,
        completedAt: new Date("2026-11-01"),
      }),
    ];
    const result = partitionPersonalTasks(tasks, {
      showOlderCompleted: true,
      hideAfterDays: 7,
      now,
    });
    expect(result.completed.map((t) => t.id)).toEqual(["done-old"]);
    expect(result.hiddenOlderCount).toBe(0);
  });

  it("keeps settling completed tasks in the open section", () => {
    const tasks = [
      task({
        id: "just-ticked",
        completed: true,
        completedAt: new Date("2026-11-12"),
      }),
      task({ id: "still-open" }),
    ];
    const result = partitionPersonalTasks(tasks, {
      showOlderCompleted: false,
      settlingIds: new Set(["just-ticked"]),
      hideAfterDays: 7,
      now,
    });
    expect(result.open.map((t) => t.id)).toEqual(["just-ticked", "still-open"]);
    expect(result.completed).toEqual([]);
  });
});

describe("mergeServerTasksWithPending", () => {
  it("preserves optimistic completed flags for in-flight ids", () => {
    const server = [
      task({ id: "a", completed: false }),
      task({ id: "b", completed: false }),
    ];
    const pending = new Map([["a", true]]);
    const merged = mergeServerTasksWithPending(server, pending);
    expect(merged[0].completed).toBe(true);
    expect(merged[0].completedAt).toBeInstanceOf(Date);
    expect(merged[1].completed).toBe(false);
  });

  it("does not override when server already matches pending", () => {
    const doneAt = new Date("2026-11-12T11:00:00.000Z");
    const server = [
      task({ id: "a", completed: true, completedAt: doneAt }),
    ];
    const merged = mergeServerTasksWithPending(
      server,
      new Map([["a", true]])
    );
    expect(merged[0].completedAt).toBe(doneAt);
  });
});
