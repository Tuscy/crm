import Link from "next/link";
import { Button, Card, CardContent } from "@stky/ui";
import { listEmailFlows } from "@/lib/email-flows/flows";
import { NewFlowButton } from "@/components/email-flows/new-flow-button";
import { DeleteFlowButton } from "@/components/email-flows/delete-flow-button";

const TRIGGER_LABELS: Record<string, string> = {
  LEAD_CREATED: "Lead created",
  LEAD_STATUS_CHANGED: "Lead status changed",
  DEAL_CREATED: "Deal created",
  DEAL_STAGE_CHANGED: "Deal stage changed",
  CLIENT_CREATED: "Client created",
  TASK_COMPLETED: "Task completed",
  MANUAL: "Manual",
};

export default async function EmailFlowsPage() {
  const flows = await listEmailFlows();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Email flows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automated email sequences triggered by CRM events.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/email-flows/templates">Templates</Link>
          </Button>
          <NewFlowButton />
        </div>
      </div>

      {flows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No flows yet. Create your first flow to start automating emails.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Flow</th>
                  <th className="px-4 py-3 font-medium">Trigger</th>
                  <th className="px-4 py-3 font-medium text-right">Active</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flows.map((flow) => (
                  <tr key={flow.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/email-flows/${flow.id}`}
                        className="font-medium hover:underline"
                      >
                        {flow.name}
                      </Link>
                      {flow.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {flow.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {TRIGGER_LABELS[flow.trigger] ?? flow.trigger}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {flow._count.enrollments}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          flow.active
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {flow.active ? "Active" : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/dashboard/email-flows/${flow.id}`}>
                            Edit
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={`/dashboard/email-flows/${flow.id}/enrollments`}
                          >
                            Enrollments
                          </Link>
                        </Button>
                        <DeleteFlowButton id={flow.id} name={flow.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
