import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import { getLeads } from "@/lib/server/actions/leads";
import { prisma } from "@stky/db";
import { UptimeStatusCard } from "@/components/dashboard/uptime-status-card";

export default async function DashboardPage() {
  const [leads, leadCount, dealCount] = await Promise.all([
    getLeads(),
    prisma.lead.count(),
    prisma.deal.count(),
  ]);

  const recentLeads = leads.slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{leadCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Deals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{dealCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Quick actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/leads"
              className="text-primary hover:underline font-medium"
            >
              View all leads →
            </Link>
          </CardContent>
        </Card>
        <UptimeStatusCard />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent leads</CardTitle>
          <p className="text-sm text-muted-foreground">
            Latest leads in the system
          </p>
        </CardHeader>
        <CardContent>
          {recentLeads.length === 0 ? (
            <p className="text-muted-foreground">No leads yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentLeads.map((lead) => (
                <li key={lead.id} className="flex justify-between items-center">
                  <div>
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="font-medium hover:underline"
                    >
                      {lead.name}
                    </Link>
                    <span className="text-muted-foreground text-sm ml-2">
                      {lead.company ?? lead.email}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {lead.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
