import Link from "next/link";
import { TicketStatusBadge } from "@/components/tickets/status-badge";
import type { TicketStatusName } from "@/lib/tickets/transitions";

type Row = {
  id: string;
  reference: string;
  title: string;
  status: string;
  type: string;
  priority: string;
  createdAt: Date;
  client?: { id: string; name: string } | null;
};

export function TicketsTable({ tickets, showClient = true }: { tickets: Row[]; showClient?: boolean }) {
  if (tickets.length === 0) {
    return <p className="text-sm text-muted-foreground">No tickets yet.</p>;
  }
  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-3 font-medium">Ref</th>
            <th className="text-left p-3 font-medium">Title</th>
            {showClient ? <th className="text-left p-3 font-medium">Client</th> : null}
            <th className="text-left p-3 font-medium">Status</th>
            <th className="text-left p-3 font-medium">Type</th>
            <th className="text-left p-3 font-medium">Priority</th>
            <th className="text-left p-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id} className="border-b last:border-0">
              <td className="p-3 font-mono text-xs">{t.reference}</td>
              <td className="p-3">
                <Link href={`/dashboard/tickets/${t.id}`} className="font-medium hover:underline">
                  {t.title}
                </Link>
              </td>
              {showClient ? (
                <td className="p-3 text-muted-foreground">{t.client?.name ?? "—"}</td>
              ) : null}
              <td className="p-3">
                <TicketStatusBadge status={t.status as TicketStatusName} />
              </td>
              <td className="p-3 text-muted-foreground">{t.type.replace(/_/g, " ").toLowerCase()}</td>
              <td className="p-3 text-muted-foreground">{t.priority.toLowerCase()}</td>
              <td className="p-3 text-muted-foreground">{t.createdAt.toLocaleDateString("en-GB")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
