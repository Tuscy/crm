"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@stky/ui";
import { deleteTask } from "@/lib/server/actions/tasks";

export function DeleteTaskButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [deleted, setDeleted] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this task?")) return;
    setDeleted(true);
    setPending(true);
    try {
      await deleteTask(taskId);
      router.refresh();
    } catch (e) {
      setDeleted(false);
      throw e;
    } finally {
      setPending(false);
    }
  }

  if (deleted) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={pending}
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
