"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@stky/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import {
  addTicketMessageAction,
  changeTicketStatusAction,
  deleteTicketAction,
  emailFinalMessageAction,
  eraseTicketsForEmailAction,
  updateTicketAction,
} from "@/lib/server/actions/tickets";
import { STAFF_STATUS_LABELS } from "@/lib/tickets/status-labels";
import type { TicketStatusName } from "@/lib/tickets/transitions";

const field = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function StatusForm({
  id,
  options,
  summary,
  finalMessage,
}: {
  id: string;
  options: TicketStatusName[];
  summary: string | null;
  finalMessage: string | null;
}) {
  const router = useRouter();
  const [to, setTo] = useState(options[0] ?? "");
  const [sum, setSum] = useState(summary ?? "");
  const [fin, setFin] = useState(finalMessage ?? "");
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  if (options.length === 0) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setNote(null);
    const res = await changeTicketStatusAction({ id, to, summary: sum, finalMessage: fin });
    setPending(false);
    if (!res.ok) return setNote({ tone: "error", text: res.error });
    if (res.redirected) setNote({ tone: "info", text: `${res.reason}. The ticket was moved to Needs human instead.` });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Change status</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <select value={to} onChange={(e) => setTo(e.target.value as TicketStatusName)} className={field}>
            {options.map((s) => (<option key={s} value={s}>{STAFF_STATUS_LABELS[s]}</option>))}
          </select>
          <div>
            <label className="text-sm font-medium">Status summary (one line, shown to the client)</label>
            <input value={sum} onChange={(e) => setSum(e.target.value)} maxLength={300} className={field} />
          </div>
          <div>
            <label className="text-sm font-medium">Final message (needed for Awaiting review and Resolved)</label>
            <textarea value={fin} onChange={(e) => setFin(e.target.value)} rows={3} className={field} />
          </div>
          {note ? <p className={note.tone === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{note.text}</p> : null}
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Update status"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ReplyForm({ id }: { id: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "INTERNAL">("PUBLIC");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await addTicketMessageAction({ id, body, visibility });
    setPending(false);
    if (!res.ok) return setError(res.error);
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} required className={field} placeholder="Write a message…" />
      <div className="flex items-center gap-3">
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as "PUBLIC" | "INTERNAL")} className="rounded-md border border-input bg-background px-2 py-1.5 text-sm">
          <option value="PUBLIC">Public (client can see)</option>
          <option value="INTERNAL">Internal note</option>
        </select>
        <Button type="submit" disabled={pending || !body.trim()}>{pending ? "Sending…" : "Send"}</Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}

export function DetailsForm({
  id,
  priority,
  type,
  assigneeType,
  assigneeId,
  shareTechnicalDetails,
}: {
  id: string;
  priority: string;
  type: string;
  assigneeType: string;
  assigneeId: string | null;
  shareTechnicalDetails: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState({ priority, type, assigneeType, assigneeId: assigneeId ?? "", shareTechnicalDetails });

  async function save() {
    setPending(true);
    setError(null);
    const res = await updateTicketAction({
      id,
      priority: state.priority,
      type: state.type,
      assigneeType: state.assigneeType as "NONE" | "HUMAN",
      assigneeId: state.assigneeType === "NONE" ? null : state.assigneeId || null,
      shareTechnicalDetails: state.shareTechnicalDetails,
    });
    setPending(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="font-medium">Priority</label>
            <select value={state.priority} onChange={(e) => setState({ ...state, priority: e.target.value })} className={field}>
              {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => (<option key={p} value={p}>{p.toLowerCase()}</option>))}
            </select>
          </div>
          <div>
            <label className="font-medium">Type</label>
            <select value={state.type} onChange={(e) => setState({ ...state, type: e.target.value })} className={field}>
              {["SITE_CHANGE", "BUG", "CONTENT", "HOSTING_UPTIME", "SEO_ADS_REPORTING", "BILLING_ADMIN", "INTERNAL", "OTHER"].map((t) => (<option key={t} value={t}>{t.replace(/_/g, " ").toLowerCase()}</option>))}
            </select>
          </div>
          <div>
            <label className="font-medium">Assignee</label>
            <select value={state.assigneeType} onChange={(e) => setState({ ...state, assigneeType: e.target.value })} className={field}>
              <option value="NONE">Unassigned</option>
              <option value="HUMAN">Human</option>
            </select>
          </div>
          {state.assigneeType !== "NONE" ? (
            <div>
              <label className="font-medium">Person</label>
              <input value={state.assigneeId} onChange={(e) => setState({ ...state, assigneeId: e.target.value })} className={field} />
            </div>
          ) : null}
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={state.shareTechnicalDetails} onChange={(e) => setState({ ...state, shareTechnicalDetails: e.target.checked })} />
          Share technical details (activity log) with the client
        </label>
        {error ? <p className="text-destructive">{error}</p> : null}
        <Button type="button" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save details"}</Button>
      </CardContent>
    </Card>
  );
}

export function EmailFinalMessageButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function send() {
    if (!confirm("Email the final message to the client? It will be signed with your name.")) return;
    setPending(true);
    setNote(null);
    const res = await emailFinalMessageAction(id);
    setPending(false);
    setNote(res.ok ? "Sent." : res.error);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="outline" size="sm" onClick={send} disabled={pending}>
        {pending ? "Sending…" : "Email final message to client"}
      </Button>
      {note ? <span className="text-sm text-muted-foreground">{note}</span> : null}
    </div>
  );
}

export function DeleteTicketButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!confirm("Permanently delete this ticket and its whole history? This cannot be undone.")) return;
    setPending(true);
    const res = await deleteTicketAction(id);
    setPending(false);
    if (!res.ok) return setError(res.error);
    router.push("/dashboard/tickets");
  }

  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="destructive" size="sm" onClick={remove} disabled={pending}>
        {pending ? "Deleting…" : "Delete ticket"}
      </Button>
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </div>
  );
}

export function EraseByEmailForm() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function erase(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`Permanently delete every ticket raised by ${email}? This cannot be undone.`)) return;
    setPending(true);
    const res = await eraseTicketsForEmailAction(email);
    setPending(false);
    setNote(res.ok ? `Deleted ${res.deleted} ticket${res.deleted === 1 ? "" : "s"}.` : res.error);
  }

  return (
    <form onSubmit={erase} className="flex flex-wrap items-center gap-3">
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="requester@example.com" className="rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>Erase tickets for this email</Button>
      {note ? <span className="text-sm text-muted-foreground">{note}</span> : null}
    </form>
  );
}
