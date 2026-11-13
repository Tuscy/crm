"use client";

import { useCan } from "@/lib/use-can";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent } from "@stky/ui";
import { createTask, deleteTask, toggleTaskCompleted } from "@/lib/server/actions/tasks";
import {
  mergeServerTasksWithPending,
  partitionPersonalTasks,
} from "@/lib/tasks/list-helpers";
import { TASK_COMPLETED_HIDE_AFTER_DAYS_DEFAULT } from "@/lib/tasks/retention";
import { TaskDetailDialog } from "./task-detail-dialog";

const inputClass =
  "rounded-md border border-input bg-background px-3 py-2 text-sm";

/** Brief pause before a ticked item leaves the open section (rapid multi-tick). */
const COMPLETE_SETTLE_MS = 450;

type PersonalTask = {
  id: string;
  title: string;
  dueDate: Date | null;
  completed: boolean;
  completedAt: Date | null;
  leadId: string | null;
  lead: { id: string; name: string } | null;
  notes: string | null;
};

export function PersonalTaskList({
  tasks,
  hideAfterDays = TASK_COMPLETED_HIDE_AFTER_DAYS_DEFAULT,
}: {
  tasks: PersonalTask[];
  hideAfterDays?: number;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();
  const [localTasks, setLocalTasks] = useState(tasks);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [settlingIds, setSettlingIds] = useState<Set<string>>(new Set());
  const [showOlderCompleted, setShowOlderCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Desired completed flag while a save is in flight (survives router.refresh).
  const pendingCompletedRef = useRef<Map<string, boolean>>(new Map());
  const settleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  useEffect(() => {
    setLocalTasks(
      mergeServerTasksWithPending(tasks, pendingCompletedRef.current)
    );
  }, [tasks]);

  useEffect(() => {
    return () => {
      settleTimersRef.current.forEach((timer) => clearTimeout(timer));
      settleTimersRef.current.clear();
    };
  }, []);

  function setPending(taskId: string, isPending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (isPending) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }

  function beginSettle(taskId: string) {
    const existing = settleTimersRef.current.get(taskId);
    if (existing) clearTimeout(existing);
    setSettlingIds((prev) => new Set(prev).add(taskId));
    const timer = setTimeout(() => {
      settleTimersRef.current.delete(taskId);
      setSettlingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }, COMPLETE_SETTLE_MS);
    settleTimersRef.current.set(taskId, timer);
  }

  function cancelSettle(taskId: string) {
    const existing = settleTimersRef.current.get(taskId);
    if (existing) {
      clearTimeout(existing);
      settleTimersRef.current.delete(taskId);
    }
    setSettlingIds((prev) => {
      if (!prev.has(taskId)) return prev;
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  }

  async function handleAdd(formData: FormData) {
    setError(null);
    const title = (formData.get("title") as string).trim();
    if (!title) return;
    const dueDateRaw = formData.get("dueDate") as string;
    try {
      await createTask(title, {
        dueDate: dueDateRaw ? new Date(dueDateRaw) : undefined,
      });
      formRef.current?.reset();
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create task");
    }
  }

  async function handleToggle(taskId: string) {
    setError(null);
    const current = localTasks.find((t) => t.id === taskId);
    if (!current) return;

    const nextCompleted = !current.completed;
    const snapshot = { ...current };

    pendingCompletedRef.current.set(taskId, nextCompleted);
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              completed: nextCompleted,
              completedAt: nextCompleted ? new Date() : null,
            }
          : t
      )
    );

    if (nextCompleted) beginSettle(taskId);
    else cancelSettle(taskId);

    setPending(taskId, true);
    try {
      await toggleTaskCompleted(taskId);
      pendingCompletedRef.current.delete(taskId);
      // Soft refresh; merge keeps any other in-flight optimistic toggles.
      startTransition(() => router.refresh());
    } catch (e) {
      pendingCompletedRef.current.delete(taskId);
      cancelSettle(taskId);
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === taskId ? snapshot : t))
      );
      setError(e instanceof Error ? e.message : "Failed to update task");
    } finally {
      setPending(taskId, false);
    }
  }

  const canDelete = useCan("task:delete");
  async function handleDelete(taskId: string) {
    if (!confirm("Delete this task?")) return;
    setError(null);
    const snapshot = localTasks.find((t) => t.id === taskId);
    if (!snapshot) return;
    cancelSettle(taskId);
    pendingCompletedRef.current.delete(taskId);
    setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));
    setPending(taskId, true);
    try {
      await deleteTask(taskId);
      startTransition(() => router.refresh());
    } catch (e) {
      setLocalTasks((prev) => {
        if (prev.some((t) => t.id === taskId)) return prev;
        return [...prev, snapshot];
      });
      setError(e instanceof Error ? e.message : "Failed to delete task");
    } finally {
      setPending(taskId, false);
    }
  }

  const { open, completed, hiddenOlderCount } = partitionPersonalTasks(
    localTasks,
    { showOlderCompleted, settlingIds, hideAfterDays }
  );

  function renderRow(task: PersonalTask) {
    const isPending = pendingIds.has(task.id);
    return (
      <li
        key={task.id}
        className={`flex items-center justify-between gap-3 py-3 transition-opacity duration-300 ${
          settlingIds.has(task.id) ? "opacity-60" : "opacity-100"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={() => handleToggle(task.id)}
            disabled={isPending}
            className="h-4 w-4 shrink-0"
            aria-label={
              task.completed ? `Mark "${task.title}" open` : `Complete "${task.title}"`
            }
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={
                  task.completed
                    ? "line-through text-muted-foreground text-sm"
                    : "text-sm"
                }
              >
                {task.title}
              </span>
              {task.lead ? (
                <Link
                  href={`/dashboard/leads/${task.lead.id}`}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  → {task.lead.name}
                </Link>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {task.dueDate ? (
                <div>
                  Due {new Date(task.dueDate).toLocaleDateString("en-GB")}
                </div>
              ) : null}
              {task.notes ? (
                <div className="text-muted-foreground/80">{task.notes}</div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TaskDetailDialog task={task} />
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => handleDelete(task.id)}
            >
              Delete
            </Button>
          )}
        </div>
      </li>
    );
  }

  const empty = open.length === 0 && completed.length === 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <form
            ref={formRef}
            action={handleAdd}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium block mb-1">Title</label>
              <input
                name="title"
                required
                placeholder="e.g. Follow up with BNI referral"
                className={`${inputClass} w-full`}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Due date</label>
              <input name="dueDate" type="date" className={inputClass} />
            </div>
            <Button type="submit">Add task</Button>
          </form>
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Card>
        <CardContent className="pt-6 space-y-6">
          {empty ? (
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
          ) : (
            <>
              <div>
                <h2 className="text-sm font-medium mb-1">Open</h2>
                {open.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No open tasks.
                  </p>
                ) : (
                  <ul className="divide-y">{open.map(renderRow)}</ul>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <h2 className="text-sm font-medium">Completed</h2>
                  {(hiddenOlderCount > 0 || showOlderCompleted) && (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                      onClick={() => setShowOlderCompleted((v) => !v)}
                    >
                      {showOlderCompleted
                        ? "Hide older completed"
                        : `Show older completed${
                            hiddenOlderCount > 0 ? ` (${hiddenOlderCount})` : ""
                          }`}
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Completed items older than {hideAfterDays} days are hidden by
                  default.
                </p>
                {completed.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    {hiddenOlderCount > 0
                      ? "No recent completed tasks."
                      : "No completed tasks."}
                  </p>
                ) : (
                  <ul className="divide-y">{completed.map(renderRow)}</ul>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
