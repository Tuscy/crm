import {
  isOlderCompletedTask,
  taskCompletedHideAfterDays,
  type TaskCompletionFields,
} from "./retention";

export type SortableTask = TaskCompletionFields & {
  dueDate: Date | string | null;
  title?: string;
};

function timeOrNull(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Ascending due date with nulls last, then stable id tie-breaker. */
export function compareOpenTasks(a: SortableTask, b: SortableTask): number {
  const aDue = timeOrNull(a.dueDate);
  const bDue = timeOrNull(b.dueDate);
  if (aDue == null && bDue != null) return 1;
  if (aDue != null && bDue == null) return -1;
  if (aDue != null && bDue != null && aDue !== bDue) return aDue - bDue;
  return a.id.localeCompare(b.id);
}

/** Newest completion first, then stable id tie-breaker. */
export function compareCompletedTasks(a: SortableTask, b: SortableTask): number {
  const aDone = timeOrNull(a.completedAt);
  const bDone = timeOrNull(b.completedAt);
  if (aDone == null && bDone != null) return 1;
  if (aDone != null && bDone == null) return -1;
  if (aDone != null && bDone != null && aDone !== bDone) return bDone - aDone;
  return a.id.localeCompare(b.id);
}

/**
 * Split + filter for the personal task list.
 * `settlingIds` stay in the open section briefly after being ticked so rapid multi-ticks work.
 */
export function partitionPersonalTasks<T extends SortableTask>(
  tasks: T[],
  opts: {
    showOlderCompleted: boolean;
    settlingIds?: ReadonlySet<string>;
    hideAfterDays?: number;
    now?: Date;
  }
): { open: T[]; completed: T[]; hiddenOlderCount: number } {
  const hideAfterDays = opts.hideAfterDays ?? taskCompletedHideAfterDays();
  const now = opts.now ?? new Date();
  const settling = opts.settlingIds ?? new Set<string>();

  const open: T[] = [];
  const completed: T[] = [];
  let hiddenOlderCount = 0;

  for (const task of tasks) {
    const older = isOlderCompletedTask(task, hideAfterDays, now);
    if (task.completed && settling.has(task.id)) {
      open.push(task);
      continue;
    }
    if (!task.completed) {
      open.push(task);
      continue;
    }
    if (older && !opts.showOlderCompleted) {
      hiddenOlderCount += 1;
      continue;
    }
    completed.push(task);
  }

  open.sort(compareOpenTasks);
  completed.sort(compareCompletedTasks);
  return { open, completed, hiddenOlderCount };
}

/**
 * Merge server tasks into local state without clobbering in-flight optimistic toggles.
 * `pendingCompleted` maps task id → desired completed flag while a save is in flight.
 */
export function mergeServerTasksWithPending<T extends SortableTask>(
  serverTasks: T[],
  pendingCompleted: ReadonlyMap<string, boolean>
): T[] {
  return serverTasks.map((task) => {
    const pending = pendingCompleted.get(task.id);
    if (pending === undefined) return task;
    if (pending === task.completed) return task;
    return {
      ...task,
      completed: pending,
      completedAt: pending ? task.completedAt ?? new Date() : null,
    };
  });
}
