import Link from "next/link";
import { getLeads } from "@/lib/server/actions/leads";
import { getStaffUsers } from "@/lib/server/actions/tasks";
import { Button } from "@stky/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import { CreateLeadForm } from "@/components/crm/create-lead-form";
import { LeadsFilters } from "@/components/crm/leads-filters";
import { leadSourceLabel } from "@stky/crm";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const status =
    typeof searchParams.status === "string" ? searchParams.status : undefined;
  const source =
    typeof searchParams.source === "string" ? searchParams.source : undefined;

  const [leads, staffUsers] = await Promise.all([
    getLeads({ q, status, source }),
    getStaffUsers(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Leads</h1>
        <CreateLeadForm staffUsers={staffUsers} />
      </div>

      <LeadsFilters q={q} status={status} source={source} />

      <Card>
        <CardHeader>
          <CardTitle>All leads</CardTitle>
          <p className="text-sm text-muted-foreground">
            {leads.length} lead{leads.length !== 1 ? "s" : ""}
          </p>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No leads match your filters.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Phone</th>
                    <th className="text-left p-3 font-medium">Company</th>
                    <th className="text-left p-3 font-medium">Source</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b last:border-0">
                      <td className="p-3">
                        <Link
                          href={`/dashboard/leads/${lead.id}`}
                          className="font-medium hover:underline"
                        >
                          {lead.name}
                        </Link>
                      </td>
                      <td className="p-3 text-muted-foreground">{lead.email}</td>
                      <td className="p-3">{lead.phone ?? "—"}</td>
                      <td className="p-3">{lead.company ?? "—"}</td>
                      <td className="p-3">{leadSourceLabel(lead.source)}</td>
                      <td className="p-3">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {lead.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/leads/${lead.id}`}>View</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
