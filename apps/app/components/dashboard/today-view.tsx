import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import type { TodayItems } from "@/lib/server/actions/today";

function formatDate(date: Date | null): string {
  if (!date) return "No date";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function TaskItem({
  task,
}: {
  task: TodayItems["overdueTasks"][number];
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{task.title}</p>
        <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
          {task.lead ? (
            <Link
              href={`/dashboard/leads/${task.lead.id}`}
              className="hover:underline"
            >
              → {task.lead.name}
            </Link>
          ) : null}
          {task.assignee ? (
            <span>· {task.assignee.name || task.assignee.email}</span>
          ) : null}
          {task.dueDate ? <span>· {formatDate(task.dueDate)}</span> : null}
        </div>
      </div>
    </div>
  );
}

function DealItem({
  deal,
}: {
  deal: TodayItems["dealsNeedingAction"][number];
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b last:border-0">
      <div className="min-w-0 flex-1">
        <Link
          href={`/dashboard/leads/${deal.lead.id}`}
          className="text-sm font-medium hover:underline"
        >
          {deal.lead.company || deal.lead.name}
        </Link>
        <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
          <span>{deal.stage.replace(/_/g, " ")}</span>
          {deal.value ? <span>· £{deal.value.toLocaleString()}</span> : null}
        </div>
      </div>
    </div>
  );
}

export function TodayView({ items }: { items: TodayItems }) {
  const totalItems =
    items.overdueTasks.length +
    items.dueTodayTasks.length +
    items.upcomingTasks.length +
    items.dealsNeedingAction.length;

  if (totalItems === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            All caught up! 🎉
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            No overdue or pending items requiring attention.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Overdue Tasks */}
      {items.overdueTasks.length > 0 ? (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Overdue ({items.overdueTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items.overdueTasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Due Today */}
      {items.dueTodayTasks.length > 0 ? (
        <Card className="border-orange-500">
          <CardHeader>
            <CardTitle className="text-base text-orange-700">
              Due Today ({items.dueTodayTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items.dueTodayTasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Upcoming This Week */}
      {items.upcomingTasks.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              This Week ({items.upcomingTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items.upcomingTasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Deals Needing Next Action */}
      {items.dealsNeedingAction.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Needs Next Action ({items.dealsNeedingAction.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Active deals without next action set
            </p>
          </CardHeader>
          <CardContent>
            {items.dealsNeedingAction.map((deal) => (
              <DealItem key={deal.id} deal={deal} />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
