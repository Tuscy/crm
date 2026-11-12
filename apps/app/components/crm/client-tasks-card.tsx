import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import { formatDateUK } from "@/lib/format";

type ClientTask = {
  id: string;
  title: string;
  completed: boolean;
  dueDate: Date | null;
  leadId: string | null;
  lead: { id: string; name: string } | null;
};

export function ClientTasksCard({ tasks }: { tasks: ClientTask[] }) {
  const incompleteTasks = tasks.filter((t) => !t.completed);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {incompleteTasks.length} incomplete of {tasks.length} total
            </p>
            <div className="space-y-2">
              {tasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-start justify-between text-sm pb-2 border-b last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className={task.completed ? "line-through text-muted-foreground" : ""}
                    >
                      {task.title}
                    </p>
                    <div className="text-xs text-muted-foreground mt-1 space-x-2">
                      {task.dueDate ? (
                        <span>{formatDateUK(task.dueDate)}</span>
                      ) : null}
                      {task.lead ? (
                        <Link
                          href={`/dashboard/leads/${task.lead.id}`}
                          className="hover:underline"
                        >
                          → {task.lead.name}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              {tasks.length > 5 ? (
                <p className="text-xs text-muted-foreground pt-1">
                  + {tasks.length - 5} more
                </p>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
