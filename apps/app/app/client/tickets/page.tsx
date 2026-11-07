import Link from "next/link";
import { redirect } from "next/navigation";
import { listClientTickets } from "@/lib/server/actions/client-tickets";
import { PortalNewTicketForm } from "@/components/tickets/portal-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";

export default async function ClientTicketsPage() {
  let tickets;
  try {
    tickets = await listClientTickets();
  } catch {
    redirect("/client/login");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Your requests</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Ask for something or report a problem</CardTitle></CardHeader>
        <CardContent><PortalNewTicketForm /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Your requests</CardTitle></CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="divide-y">
              {tickets.map((t) => (
                <li key={t.id} className="py-3">
                  <Link href={`/client/tickets/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
                  <p className="text-sm text-muted-foreground">
                    {t.reference} · {t.statusLabel}
                    {t.statusSummary ? ` · ${t.statusSummary}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
