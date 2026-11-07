import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getClientTicket } from "@/lib/server/actions/client-tickets";
import { PortalReplyForm } from "@/components/tickets/portal-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";

export default async function ClientTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let ticket;
  try {
    ticket = await getClientTicket(id);
  } catch {
    redirect("/client/login");
  }
  if (!ticket) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/client/tickets" className="text-sm text-muted-foreground hover:text-foreground">← Your requests</Link>
        <h1 className="text-2xl font-bold mt-1">{ticket.title}</h1>
        <p className="text-sm text-muted-foreground">{ticket.reference} · {ticket.statusLabel}</p>
        {ticket.statusSummary ? <p className="mt-1 text-sm">{ticket.statusSummary}</p> : null}
      </div>

      {ticket.finalMessage ? (
        <Card>
          <CardHeader><CardTitle className="text-base">The outcome</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{ticket.finalMessage}</p></CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle className="text-base">Conversation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {ticket.messages.length === 0 ? <p className="text-sm text-muted-foreground">No messages yet.</p> : null}
          {ticket.messages.map((m) => (
            <div key={m.id} className="rounded-md border p-3 text-sm">
              <div className="mb-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{m.from}</span> · {m.createdAt.toLocaleString("en-GB")}
              </div>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          ))}
          <PortalReplyForm id={ticket.id} />
        </CardContent>
      </Card>

      {ticket.technicalLog ? (
        <details className="rounded-md border">
          <summary className="cursor-pointer p-3 text-sm font-medium">Technical details</summary>
          <ul className="border-t p-3 text-xs font-mono space-y-1">
            {ticket.technicalLog.map((e) => (
              <li key={e.seq}>{e.createdAt.toLocaleString("en-GB")} · {e.kind}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
