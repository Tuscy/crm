import { prisma } from "@stky/db";
import { logStky } from "@/lib/observability";

/** Hide completed tasks older than this many days from the list by default. */
export const TASK_COMPLETED_HIDE_AFTER_DAYS_DEFAULT = 7;
/** Auto-delete completed tasks this many days after completion. */
export const TASK_COMPLETED_DELETE_AFTER_DAYS_DEFAULT = 30;

export function taskCompletedHideAfterDays(): number {
  const raw = process.env.TASK_COMPLETED_HIDE_AFTER_DAYS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : TASK_COMPLETED_HIDE_AFTER_DAYS_DEFAULT;
}

export function taskCompletedDeleteAfterDays(): number {
  const raw = process.env.TASK_COMPLETED_DELETE_AFTER_DAYS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : TASK_COMPLETED_DELETE_AFTER_DAYS_DEFAULT;
}

export function daysAgoCutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

export type TaskCompletionFields = {
  id: string;
  completed: boolean;
  completedAt: Date | string | null;
};

/**
 * True when a completed task should be hidden unless "Show older completed" is on.
 * Tasks with completed=true but no completedAt are treated as old (hidden).
 */
export function isOlderCompletedTask(
  task: TaskCompletionFields,
  hideAfterDays: number,
  now: Date = new Date()
): boolean {
  if (!task.completed) return false;
  if (!task.completedAt) return true;
  const completedAt = new Date(task.completedAt);
  return completedAt.getTime() < daysAgoCutoff(now, hideAfterDays).getTime();
}

/** Pure selection: completed tasks whose completedAt is strictly before the cutoff. */
export function selectCompletedTasksForPurge<T extends TaskCompletionFields>(
  tasks: T[],
  deleteAfterDays: number,
  now: Date = new Date()
): T[] {
  const cutoff = daysAgoCutoff(now, deleteAfterDays).getTime();
  return tasks.filter((task) => {
    if (!task.completed) return false;
    if (!task.completedAt) return false;
    return new Date(task.completedAt).getTime() < cutoff;
  });
}

/**
 * Deletes completed tasks older than the delete threshold.
 * Never deletes open (incomplete) tasks. Logs the count deleted.
 */
export async function purgeOldCompletedTasks(now = new Date()) {
  const deleteAfterDays = taskCompletedDeleteAfterDays();
  const cutoff = daysAgoCutoff(now, deleteAfterDays);

  const result = await prisma.task.deleteMany({
    where: {
      completed: true,
      completedAt: { lt: cutoff },
    },
  });

  logStky("task_completed_purge", {
    deleted: result.count,
    deleteAfterDays,
    cutoff: cutoff.toISOString(),
  });

  return {
    deleted: result.count,
    deleteAfterDays,
    cutoff: cutoff.toISOString(),
  };
}
