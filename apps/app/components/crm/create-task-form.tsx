"use client";

import { useState } from "react";
import { Button } from "@stky/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import { createTask } from "@/lib/server/actions/tasks";

const inputClass = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const labelClass = "text-sm font-medium";

type StaffUser = { id: string; name: string | null; email: string };

export function CreateTaskForm({
  leadId,
  staffUsers,
}: {
  leadId: string;
  staffUsers: StaffUser[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Add task
      </Button>
    );
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const title = (formData.get("title") as string).trim();
      if (!title) throw new Error("Title is required");
      const dueDateRaw = formData.get("dueDate") as string;
      const assigneeId = (formData.get("assigneeId") as string) || undefined;
      const notes = (formData.get("notes") as string) || undefined;

      await createTask(title, {
        leadId,
        dueDate: dueDateRaw ? new Date(dueDateRaw) : undefined,
        assigneeId,
        notes,
      });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New task</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Title *</label>
            <input
              name="title"
              required
              placeholder="e.g. Send proposal"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Due date</label>
            <input name="dueDate" type="date" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Assignee</label>
            <select name="assigneeId" className={inputClass} defaultValue="">
              <option value="">Unassigned</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Notes (optional)</label>
            <textarea
              name="notes"
              rows={2}
              placeholder="Additional context or details"
              className={inputClass}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Creating…" : "Create task"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
