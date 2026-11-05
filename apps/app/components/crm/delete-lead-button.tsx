"use client";

import { useCan } from "@/lib/use-can";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@stky/ui";
import { deleteLead } from "@/lib/server/actions/leads";

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  const allowed = useCan("lead:delete");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this lead?")) return;
    setPending(true);
    try {
      await deleteLead(leadId);
      router.push("/dashboard/leads");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!allowed) return null;

  return (
    <Button
      type="button"
      variant="destructive"
      onClick={handleDelete}
      disabled={pending}
    >
      {pending ? "Deleting…" : "Delete lead"}
    </Button>
  );
}
