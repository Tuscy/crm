"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import { toggleN8nWorkflowActive } from "@/lib/server/actions/n8n-workflows";
import type { N8nWorkflowSummary } from "@/lib/n8n/client";

type Props = {
  workflows: N8nWorkflowSummary[];
  /** Public n8n origin (from server env); used for “Open in n8n” links in the browser. */
  n8nBaseUrl: string;
};

function editorUrl(base: string, workflowId: string): string {
  const origin = base.replace(/\/$/, "");
  if (!origin) return "#";
  return `${origin}/workflow/${encodeURIComponent(workflowId)}`;
}

export function AutomationsWorkflowTable({ workflows, n8nBaseUrl }: Props) {
  const router = useRouter();
  const [localWorkflows, setLocalWorkflows] = useState(workflows);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalWorkflows(workflows);
  }, [workflows]);

  function setPending(id: string, isPending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (isPending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function onToggle(id: string, nextActive: boolean) {
    setError(null);
    const previous = localWorkflows;
    setLocalWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, active: nextActive } : w))
    );
    setPending(id, true);
    try {
      const result = await toggleN8nWorkflowActive(id, nextActive);
      if (result.ok) {
        router.refresh();
      } else {
        setLocalWorkflows(previous);
        setError(result.error);
      }
    } finally {
      setPending(id, false);
    }
  }

  if (localWorkflows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No workflows yet</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Create workflows in n8n; they will appear here when the API returns them.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Active</th>
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Updated</th>
              <th className="text-right p-3 font-medium">Open</th>
            </tr>
          </thead>
          <tbody>
            {localWorkflows.map((w) => (
              <tr key={w.id} className="border-b last:border-0">
                <td className="p-3">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={w.active}
                      disabled={pendingIds.has(w.id)}
                      onChange={(e) => onToggle(w.id, e.target.checked)}
                    />
                    <span className="sr-only">Toggle active</span>
                  </label>
                </td>
                <td className="p-3 font-medium">{w.name}</td>
                <td className="p-3 text-muted-foreground">
                  {w.updatedAt
                    ? new Date(w.updatedAt).toLocaleString()
                    : "—"}
                </td>
                <td className="p-3 text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={editorUrl(n8nBaseUrl, w.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open in n8n
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
