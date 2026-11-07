import Link from "next/link";
import { notFound } from "next/navigation";
import { getTicketDetail } from "@/lib/server/actions/tickets";
import { currentStaffCan } from "@/lib/server/guard";
import { TicketStatusBadge } from "@/components/tickets/status-badge";
import { DetailsForm, EmailFinalMessageButton, ReplyForm, StatusForm } from "@/components/tickets/ticket-controls";
import { CLIENT_STATUS_LABELS } from "@/lib/tickets/status-labels";
import { allowedTransitions, type TicketStatusName } from "@/lib/tickets/transitions";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [ticket, canUpdate] = await Promise.all([getTicketDetail(id), currentStaffCan("ticket:update")]);
  if (!ticket) notFound();
  const status = ticket.status as TicketStatusName;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/tickets" className="text-sm text-muted-foreground hover:text-foreground">← Back to tickets</Link>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <span className="font-mono text-sm text-muted-foreground">{ticket.reference}</span>
          <h1 className="text-2xl font-bold">{ticket.title}</h1>
          <TicketStatusBadge status={status} />
        </div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/dashboard/clients/${ticket.client.id}?tab=tickets`} className="hover:underline">{ticket.client.name}</Link>
          {ticket.site ? ` · ${ticket.site.customDomain ?? ticket.site.subdomain ?? ticket.site.slug}` : ""}
          {" · "}raised via {ticket.source.replace(/_/g, " ").toLowerCase()}
          {ticket.requesterName ? ` by ${ticket.requesterName}` : ""}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">What the client sees</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="font-medium">Status:</span> {CLIENT_STATUS_LABELS[status]}</p>
          <p><span className="font-medium">Summary:</span> {ticket.statusSummary ?? <span className="text-muted-foreground">None yet</span>}</p>
          <p><span className="font-medium">Final message:</span> {ticket.finalMessage ?? <span className="text-muted-foreground">None yet</span>}</p>
          {canUpdate && ticket.finalMessage && ticket.requesterEmail ? <EmailFinalMessageButton id={ticket.id} /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
        <CardContent><p className="text-sm whitespace-pre-wrap">{ticket.description}</p></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Conversation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {ticket.messages.length === 0 ? <p className="text-sm text-muted-foreground">No messages yet.</p> : null}
          {ticket.messages.map((m) => (
            <div key={m.id} className={`rounded-md border p-3 text-sm ${m.visibility === "INTERNAL" ? "bg-amber-50" : ""}`}>
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{m.authorName ?? m.authorType.toLowerCase()}</span>
                <span>{m.createdAt.toLocaleString("en-GB")}</span>
                {m.visibility === "INTERNAL" ? <span className="rounded bg-amber-200 px-1.5 py-0.5 font-medium text-amber-900">Internal</span> : null}
              </div>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          ))}
          {canUpdate ? <ReplyForm id={ticket.id} /> : null}
        </CardContent>
      </Card>

      {canUpdate ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <StatusForm id={ticket.id} options={[...allowedTransitions(status)]} summary={ticket.statusSummary} finalMessage={ticket.finalMessage} />
          <DetailsForm
            id={ticket.id}
            priority={ticket.priority}
            type={ticket.type}
            assigneeType={ticket.assigneeType}
            assigneeId={ticket.assigneeId}
            agentEligible={ticket.agentEligible}
            shareTechnicalDetails={ticket.shareTechnicalDetails}
          />
        </div>
      ) : null}

      <details className="rounded-md border">
        <summary className="cursor-pointer p-3 text-sm font-medium">Activity log ({ticket.events.length})</summary>
        <div className="border-t overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2 font-medium">#</th>
                <th className="text-left p-2 font-medium">When</th>
                <th className="text-left p-2 font-medium">Event</th>
                <th className="text-left p-2 font-medium">Actor</th>
                <th className="text-left p-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {ticket.events.map((e) => (
                <tr key={e.id} className="border-b last:border-0 align-top">
                  <td className="p-2 font-mono">{e.seq}</td>
                  <td className="p-2 whitespace-nowrap">{e.createdAt.toLocaleString("en-GB")}</td>
                  <td className="p-2 font-mono">{e.kind}</td>
                  <td className="p-2">{e.actorName ?? e.actorType.toLowerCase()}</td>
                  <td className="p-2 font-mono break-all text-muted-foreground">{e.payload ? JSON.stringify(e.payload) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
