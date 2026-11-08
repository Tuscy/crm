import { notFound } from "next/navigation";
import Link from "next/link";
import { getLeadById } from "@/lib/server/actions/leads";
import { getLeadConversion } from "@/lib/server/actions/lead-conversions";
import { getStaffUsers } from "@/lib/server/actions/tasks";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import { UpdateLeadForm } from "@/components/crm/update-lead-form";
import { DeleteLeadButton } from "@/components/crm/delete-lead-button";
import { LeadConversionForm } from "@/components/crm/lead-conversion-form";
import { CreateTaskForm } from "@/components/crm/create-task-form";
import { DeleteTaskButton } from "@/components/crm/delete-task-button";
import { packageLabel } from "@stky/crm";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "conversion", label: "Conversion" },
] as const;

type TabId = (typeof TABS)[number]["id"] | "edit";

function resolveTab(rawTab: string | undefined): TabId {
  if (rawTab === "conversion") return "conversion";
  if (rawTab === "edit") return "edit";
  return "overview";
}

function LeadActivity({ lead }: { lead: NonNullable<Awaited<ReturnType<typeof getLeadById>>> }) {
  const items = [
    ...lead.notes.map((n) => ({
      kind: "note" as const,
      at: n.createdAt,
      text: n.content,
      id: n.id,
    })),
    ...lead.tasks.map((t) => ({
      kind: "task" as const,
      at: t.dueDate ?? lead.createdAt,
      text: t.title,
      completed: t.completed,
      id: t.id,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <p className="text-sm text-muted-foreground">
          Notes and tasks, newest first
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className="text-sm border-l-2 border-muted pl-3 py-1"
              >
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {item.kind}
                </span>
                {item.kind === "task" && item.completed ? (
                  <span className="line-through text-muted-foreground ml-2">
                    {item.text}
                  </span>
                ) : (
                  <span className="ml-2">{item.text}</span>
                )}
                <span className="text-muted-foreground text-xs ml-2 block sm:inline">
                  {new Date(item.at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const [lead, staffUsers, conversion] = await Promise.all([
    getLeadById(id),
    getStaffUsers(),
    getLeadConversion(id),
  ]);
  if (!lead) notFound();

  const activeTab = resolveTab(rawTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/leads"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to leads
          </Link>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold">{lead.name}</h1>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">
              {lead.status.replace(/_/g, " ")}
            </span>
            {lead.source ? (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {lead.source}
              </span>
            ) : null}
          </div>
          {lead.company ? (
            <p className="text-sm text-muted-foreground">{lead.company}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">{lead.email}</p>
          {lead.phone ? (
            <p className="text-sm text-muted-foreground">{lead.phone}</p>
          ) : null}
          {lead.website ? (
            <p className="text-sm text-muted-foreground">
              <a
                href={lead.website}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                {lead.website}
              </a>
            </p>
          ) : null}
          {conversion?.package ? (
            <p className="text-sm text-muted-foreground mt-1">
              Conversion package:{" "}
              <span className="font-medium text-foreground">
                {packageLabel(conversion.package)}
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/leads/${id}?tab=edit`}>Edit</Link>
          </Button>
          <DeleteLeadButton leadId={id} />
        </div>
      </div>

      {/* Tab bar */}
      {activeTab !== "edit" ? (
        <div className="border-b border-border">
          <nav className="-mb-px flex gap-6">
            {TABS.map(({ id: tabId, label }) => (
              <Link
                key={tabId}
                href={
                  tabId === "overview"
                    ? `/dashboard/leads/${id}`
                    : `/dashboard/leads/${id}?tab=${tabId}`
                }
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tabId
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}

      {/* Tab content */}
      {activeTab === "overview" && (
        <>
          <LeadActivity lead={lead} />
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Tasks</CardTitle>
                <CreateTaskForm leadId={id} staffUsers={staffUsers} />
              </div>
            </CardHeader>
            <CardContent>
              {lead.tasks.length === 0 ? (
                <p className="text-muted-foreground text-sm">No tasks yet.</p>
              ) : (
                <ul className="space-y-2">
                  {lead.tasks.map((t) => (
                    <li key={t.id} className="flex justify-between text-sm">
                      <div>
                        <span
                          className={
                            t.completed
                              ? "line-through text-muted-foreground"
                              : ""
                          }
                        >
                          {t.title}
                        </span>
                        {t.assignee ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            → {t.assignee.name ?? t.assignee.email}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {t.dueDate && (
                          <span className="text-muted-foreground text-xs">
                            {new Date(t.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        <DeleteTaskButton taskId={t.id} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "conversion" && (
        <LeadConversionForm leadId={id} initial={conversion} />
      )}

      {activeTab === "edit" && (
        <div className="space-y-4">
          <Link
            href={`/dashboard/leads/${id}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to overview
          </Link>
          <UpdateLeadForm lead={lead} />
        </div>
      )}
    </div>
  );
}
