import { currentStaffCan } from "@/lib/server/guard";
import { listAuditLog } from "@/lib/server/actions/audit-log";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ outcome?: string; action?: string }>;
}) {
  if (!(await currentStaffCan("audit:read"))) {
    return <p className="text-sm text-muted-foreground">Only admins can view the audit log.</p>;
  }
  const sp = await searchParams;
  const rows = await listAuditLog({
    outcome: sp.outcome === "DENIED" || sp.outcome === "ALLOWED" ? sp.outcome : undefined,
    action: sp.action?.trim() || undefined,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Audit log</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Every write is recorded with who, what and when. &ldquo;Denied&rdquo; rows are attempts a role wasn&rsquo;t allowed to make. Latest 200 shown.
        </p>
        <div className="flex gap-3 text-sm mt-2">
          <a className="underline" href="/dashboard/settings/audit-log">All</a>
          <a className="underline" href="?outcome=DENIED">Denied only</a>
          <a className="underline" href="?action=delete">Deletes</a>
        </div>
      </div>
      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-2">When</th>
              <th className="p-2">Who</th>
              <th className="p-2">Action</th>
              <th className="p-2">Record</th>
              <th className="p-2">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2 whitespace-nowrap">{r.createdAt.toLocaleString("en-GB")}</td>
                <td className="p-2">{r.actorEmail ?? "—"}{r.actorRole ? <span className="text-xs text-muted-foreground"> ({r.actorRole})</span> : null}</td>
                <td className="p-2"><code className="text-xs">{r.action}</code></td>
                <td className="p-2 text-xs">{r.entity ?? "—"}{r.entityId ? ` · ${r.entityId}` : ""}</td>
                <td className={`p-2 ${r.outcome === "DENIED" ? "text-destructive font-medium" : ""}`}>{r.outcome}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-4 text-muted-foreground" colSpan={5}>Nothing recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
