import Link from "next/link";
import { listTickets } from "@/lib/server/actions/tickets";
import { TicketsTable } from "@/components/tickets/tickets-table";
import { STAFF_STATUS_LABELS } from "@/lib/tickets/status-labels";
import { TICKET_STATUSES } from "@/lib/tickets/transitions";
import { currentStaffCan } from "@/lib/server/guard";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@stky/ui";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const [tickets, canCreate] = await Promise.all([
    listTickets({ status }),
    currentStaffCan("ticket:create"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tickets</h1>
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/tickets/new">New ticket</Link>
          </Button>
        ) : null}
      </div>
      <nav className="flex flex-wrap gap-2 text-sm">
        <Link href="/dashboard/tickets" className={`rounded-full border px-3 py-1 ${!status ? "bg-primary text-primary-foreground" : ""}`}>All</Link>
        {TICKET_STATUSES.map((s) => (
          <Link key={s} href={`/dashboard/tickets?status=${s}`} className={`rounded-full border px-3 py-1 ${status === s ? "bg-primary text-primary-foreground" : ""}`}>
            {STAFF_STATUS_LABELS[s]}
          </Link>
        ))}
      </nav>
      <Card>
        <CardHeader><CardTitle>{status ? STAFF_STATUS_LABELS[status as keyof typeof STAFF_STATUS_LABELS] ?? "Tickets" : "All tickets"}</CardTitle></CardHeader>
        <CardContent><TicketsTable tickets={tickets} /></CardContent>
      </Card>
    </div>
  );
}
