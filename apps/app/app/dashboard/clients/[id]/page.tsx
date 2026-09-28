import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientById } from "@/lib/server/actions/clients";
import { EditClientPackageForm } from "@/components/crm/edit-client-package-form";
import { SiteBuildsTab } from "@/components/crm/site-builds-tab";
import { ClientInvoicesCard } from "@/components/xero/client-invoices-card";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";

const PACKAGE_LABELS: Record<string, string> = {
  VOLTAGE: "Voltage",
  CHARGE: "Charge",
  GRID: "Grid",
};

const SERVICE_LABELS: Record<string, string> = {
  BRANDING: "Branding",
  WEB: "Web",
  ADS: "Google Ads",
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "site-builds", label: "Site Builds" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const client = await getClientById(id);
  if (!client) notFound();

  const activeTab: TabId =
    rawTab === "site-builds" ? "site-builds" : "overview";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/clients"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to clients
          </Link>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold">{client.name}</h1>
            {client.package ? (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {PACKAGE_LABELS[client.package] ?? client.package}
              </span>
            ) : null}
          </div>
          {client.companyName ? (
            <p className="text-sm text-muted-foreground">{client.companyName}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {client.primaryContactEmail}
          </p>
          {client.services.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {client.services.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
                >
                  {SERVICE_LABELS[s.type] ?? s.type}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-6">
          {TABS.map(({ id: tabId, label }) => (
            <Link
              key={tabId}
              href={
                tabId === "overview"
                  ? `/dashboard/clients/${id}`
                  : `/dashboard/clients/${id}?tab=${tabId}`
              }
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tabId
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <>
          <EditClientPackageForm
            clientId={client.id}
            initialPackage={client.package}
            initialServices={client.services.map((s) => s.type)}
          />

          {(client.industry ||
            client.serviceNotes ||
            client.contactPhone ||
            client.contactAddress ||
            client.companiesHouseNumber ||
            client.billingPeriod ||
            client.billingPrice != null) && (
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                {client.industry ? (
                  <div>
                    <span className="font-medium">Industry</span>
                    <p className="text-muted-foreground">{client.industry}</p>
                  </div>
                ) : null}
                {client.serviceNotes ? (
                  <div className="sm:col-span-2">
                    <span className="font-medium">Service notes</span>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {client.serviceNotes}
                    </p>
                  </div>
                ) : null}
                {client.contactPhone ? (
                  <div>
                    <span className="font-medium">Phone</span>
                    <p className="text-muted-foreground">{client.contactPhone}</p>
                  </div>
                ) : null}
                {client.contactAddress ? (
                  <div className="sm:col-span-2">
                    <span className="font-medium">Address</span>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {client.contactAddress}
                    </p>
                  </div>
                ) : null}
                {client.companiesHouseNumber ? (
                  <div>
                    <span className="font-medium">Companies House</span>
                    <p className="text-muted-foreground">
                      {client.companiesHouseNumber}
                    </p>
                  </div>
                ) : null}
                {client.billingPeriod || client.billingPrice != null ? (
                  <div>
                    <span className="font-medium">Billing</span>
                    <p className="text-muted-foreground">
                      {client.billingPrice != null
                        ? `${client.billingCurrency ?? "USD"} ${client.billingPrice.toString()}`
                        : null}
                      {client.billingPeriod
                        ? `${client.billingPrice != null ? " · " : ""}${client.billingPeriod}`
                        : null}
                    </p>
                    {client.billingNotes ? (
                      <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                        {client.billingNotes}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {client.leads.length} lead{client.leads.length !== 1 ? "s" : ""}{" "}
                  linked to this client.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Portal users</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {client.memberships.length} user
                  {client.memberships.length !== 1 ? "s" : ""} with access to the
                  client portal.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                {client.analyticsCredentials.filter((a) => a.type !== "GBP")
                  .length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No GA4 or Search Console credentials.{" "}
                    <Link
                      href="/dashboard/settings/analytics"
                      className="underline hover:text-foreground"
                    >
                      Connect in settings
                    </Link>
                    .
                  </p>
                ) : (
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {client.analyticsCredentials
                      .filter((a) => a.type !== "GBP")
                      .map((a) => (
                        <li key={a.id}>
                          {a.type === "GA4" ? "GA4" : "Search Console"}:{" "}
                          <span className="font-mono">{a.accountId}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Business Profile</CardTitle>
              </CardHeader>
              <CardContent>
                {!client.analyticsCredentials.some((a) => a.type === "GBP") ? (
                  <p className="text-sm text-muted-foreground">
                    No GBP location connected.{" "}
                    <Link
                      href="/dashboard/settings/analytics"
                      className="underline hover:text-foreground"
                    >
                      Connect in settings
                    </Link>
                    .
                  </p>
                ) : (
                  <div className="text-sm text-muted-foreground space-y-2">
                    {client.analyticsCredentials
                      .filter((a) => a.type === "GBP")
                      .map((a) => (
                        <p key={a.id} className="font-mono text-xs">
                          {a.accountId}
                        </p>
                      ))}
                    <Link
                      href={`/dashboard/business-profile?clientId=${client.id}`}
                      className="text-xs underline hover:text-foreground"
                    >
                      View GBP →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Google Ads</CardTitle>
              </CardHeader>
              <CardContent>
                {client.googleAdsConnections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No Ads accounts linked.{" "}
                    <Link
                      href="/dashboard/google-ads/settings"
                      className="underline hover:text-foreground"
                    >
                      Add a mapping
                    </Link>{" "}
                    or open the{" "}
                    <Link
                      href={`/dashboard/google-ads?clientId=${client.id}`}
                      className="underline hover:text-foreground"
                    >
                      Google Ads tab
                    </Link>
                    .
                  </p>
                ) : (
                  <ul className="text-sm text-muted-foreground space-y-2">
                    {client.googleAdsConnections.map((g) => (
                      <li key={g.id}>
                        <Link
                          href={`/dashboard/google-ads?adsCustomerId=${g.googleAdsCustomerId}&clientId=${client.id}`}
                          className="underline hover:text-foreground"
                        >
                          {g.displayName ?? g.label ?? g.googleAdsCustomerId}
                        </Link>
                        <span className="font-mono text-xs ml-1">
                          ({g.googleAdsCustomerId})
                        </span>
                      </li>
                    ))}
                    <li>
                      <Link
                        href={`/dashboard/google-ads?clientId=${client.id}`}
                        className="text-xs underline hover:text-foreground"
                      >
                        View Google Ads →
                      </Link>
                    </li>
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <ClientInvoicesCard clientId={client.id} />

          {client.activityLogs.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="relative border-l border-muted ml-2 space-y-4">
                  {client.activityLogs.map((log) => (
                    <li key={log.id} className="ml-4">
                      <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-background bg-muted-foreground/40" />
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {log.type.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {log.actor.name ?? log.actor.email}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {log.body ? (
                        <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                          {log.body}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {activeTab === "site-builds" && (
        <SiteBuildsTab clientId={client.id} siteBuilds={client.siteBuilds} />
      )}
    </div>
  );
}
