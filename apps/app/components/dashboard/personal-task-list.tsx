"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent } from "@stky/ui";
import { createTask, deleteTask, toggleTaskCompleted } from "@/lib/server/actions/tasks";

const inputClass =
  "rounded-md border border-input bg-background px-3 py-2 text-sm";

type PersonalTask = {
  id: string;
  title: string;
  dueDate: Date | null;
  completed: boolean;
  leadId: string | null;
  lead: { id: string; name: string } | null;
};

export function PersonalTaskList({ tasks }: { tasks: PersonalTask[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [localTasks, setLocalTasks] = useState(tasks);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  function setPending(taskId: string, isPending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (isPending) next.add(taskId);
      else next.delete(taskId);
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
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create task");
    }
  }

  async function handleToggle(taskId: string) {
    setError(null);
    const previous = localTasks;
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
    setPending(taskId, true);
    try {
      await toggleTaskCompleted(taskId);
      router.refresh();
    } catch (e) {
      setLocalTasks(previous);
      setError(e instanceof Error ? e.message : "Failed to update task");
    } finally {
      setPending(taskId, false);
    }
  }

  async function handleDelete(taskId: string) {
    if (!confirm("Delete this task?")) return;
    setError(null);
    const previous = localTasks;
    setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));
    setPending(taskId, true);
    try {
      await deleteTask(taskId);
      router.refresh();
    } catch (e) {
      setLocalTasks(previous);
      setError(e instanceof Error ? e.message : "Failed to delete task");
    } finally {
      setPending(taskId, false);
    }
  }

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
        <CardContent className="pt-6">
          {localTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
          ) : (
            <ul className="divide-y">
              {localTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggle(task.id)}
                      disabled={pendingIds.has(task.id)}
                      className="h-4 w-4 shrink-0"
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
                      {task.dueDate ? (
                        <span className="text-xs text-muted-foreground">
                          Due {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pendingIds.has(task.id)}
                    onClick={() => handleDelete(task.id)}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
