"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@stky/ui";
import { deleteEmailFlow } from "@/lib/email-flows/flows";

export function DeleteFlowButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [deleted, setDeleted] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete flow "${name}"? This removes the flow and its enrollment history, and deletes the workflow from n8n. This cannot be undone.`
      )
    ) {
      return;
    }
    setDeleted(true);
    setPending(true);
    try {
      await deleteEmailFlow(id);
      toast.success("Flow deleted");
      router.refresh();
    } catch (e) {
      setDeleted(false);
      toast.error(e instanceof Error ? e.message : "Failed to delete flow");
    } finally {
      setPending(false);
    }
  }

  if (deleted) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDelete}
      disabled={pending}
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
