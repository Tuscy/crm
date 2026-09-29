"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Card, CardContent } from "@stky/ui";
import { cancelEnrollment } from "@/lib/email-flows/enrollments";

type Send = {
  id: string;
  stepIndex: number;
  subject: string;
  sentAt: string;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
};

type Enrollment = {
  id: string;
  name: string;
  kind: string;
  enrolledAt: string;
  currentStep: number;
  status: string;
  sends: Send[];
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  COMPLETED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  CANCELLED: "bg-muted text-muted-foreground",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function Stat({ label, at }: { label: string; at: string | null }) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${
        at ? "text-foreground" : "text-muted-foreground/50"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          at ? "bg-green-500" : "bg-muted-foreground/30"
        }`}
      />
      {label}
    </span>
  );
}

export function EnrollmentsTable({
  enrollments,
}: {
  enrollments: Enrollment[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [localEnrollments, setLocalEnrollments] = useState(enrollments);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalEnrollments(enrollments);
  }, [enrollments]);

  function setPending(id: string, isPending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (isPending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleCancel(id: string) {
    if (!window.confirm("Cancel this enrollment? No further emails will send.")) {
      return;
    }
    const previous = localEnrollments;
    setLocalEnrollments((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "CANCELLED" } : e))
    );
    setPending(id, true);
    try {
      await cancelEnrollment(id);
      toast.success("Enrollment cancelled");
      router.refresh();
    } catch (e) {
      setLocalEnrollments(previous);
      toast.error(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setPending(id, false);
    }
  }

  if (localEnrollments.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No one is enrolled in this flow yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Enrolled</th>
              <th className="px-4 py-3 font-medium text-right">Step</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {localEnrollments.map((e) => (
              <Fragment key={e.id}>
                <tr className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((prev) => (prev === e.id ? null : e.id))
                      }
                      className="text-left font-medium hover:underline"
                    >
                      {e.name}
                    </button>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {e.kind}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(e.enrolledAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {e.currentStep + 1}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_BADGE[e.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setExpanded((prev) => (prev === e.id ? null : e.id))
                        }
                      >
                        {expanded === e.id ? "Hide" : "Sends"}
                      </Button>
                      {e.status === "ACTIVE" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendingIds.has(e.id)}
                          onClick={() => handleCancel(e.id)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                {expanded === e.id && (
                  <tr className="bg-muted/30">
                    <td colSpan={5} className="px-4 py-3">
                      {e.sends.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No emails sent yet for this enrollment.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {e.sends.map((s) => (
                            <div
                              key={s.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
                            >
                              <div className="min-w-0">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Step {s.stepIndex + 1}
                                </span>
                                <p className="truncate text-sm">{s.subject}</p>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                <Stat label="Sent" at={s.sentAt} />
                                <Stat label="Delivered" at={s.deliveredAt} />
                                <Stat label="Opened" at={s.openedAt} />
                                <Stat label="Clicked" at={s.clickedAt} />
                                {s.bouncedAt && (
                                  <span className="text-red-600">Bounced</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
