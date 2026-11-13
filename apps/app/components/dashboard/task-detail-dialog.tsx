"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@stky/ui";
import { Button } from "@stky/ui";
import { updateTask } from "@/lib/server/actions/tasks";
import { formatDateUK } from "@/lib/format";

type Task = {
  id: string;
  title: string;
  dueDate: Date | null;
  completed: boolean;
  notes: string | null;
  lead: { id: string; name: string } | null;
};

export function TaskDetailDialog({ task }: { task: Task }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSaving(true);
    try {
      const title = (formData.get("title") as string).trim();
      const notes = (formData.get("notes") as string).trim() || null;
      const dueDateRaw = formData.get("dueDate") as string;
      const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;

      await updateTask(task.id, { title, notes, dueDate });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="text-sm text-primary hover:underline"
          aria-label="View task details"
        >
          Details
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Task details</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Title</label>
            <input
              name="title"
              required
              defaultValue={task.title}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Due date</label>
            <input
              name="dueDate"
              type="date"
              defaultValue={
                task.dueDate
                  ? new Date(task.dueDate).toISOString().slice(0, 10)
                  : ""
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Notes</label>
            <textarea
              name="notes"
              rows={4}
              defaultValue={task.notes || ""}
              placeholder="Add any notes or details about this task..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              Status:{" "}
              <span className="font-medium">
                {task.completed ? "Completed" : "Open"}
              </span>
            </p>
            {task.lead && (
              <p>
                Lead:{" "}
                <a
                  href={`/dashboard/leads/${task.lead.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {task.lead.name}
                </a>
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
