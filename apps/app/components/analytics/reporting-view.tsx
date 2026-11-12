"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@stky/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import type { Ga4OverviewResult, Ga4PageRow } from "@/lib/analytics/ga4-api";
import type { GscQueryRow, GscPageRow } from "@/lib/analytics/gsc-api";
import {
  ConnectionStateIndicator,
  deriveConnectionState,
} from "./connection-state-indicator";

// ── helpers ──────────────────────────────────────────────────────────────────

function pct(n: number, decimals = 1): string {
  return (n * 100).toFixed(decimals) + "%";
}

function fmt(n: number): string {
  return n.toLocaleString();
}

const RANGE_LABELS: Record<string, string> = {
  "7d": "7 days",
  "28d": "28 days",
  "90d": "90 days",
};

// ── CSV export ────────────────────────────────────────────────────────────────

function downloadCsv(filename: string, rows: string[][]): void {
  const content = rows
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── section shells ────────────────────────────────────────────────────────────

function SectionShell({
  title,
  children,
  onExport,
  exportDisabled,
  orgLevel,
}: {
  title: string;
  children: React.ReactNode;
  onExport?: () => void;
  exportDisabled?: boolean;
  orgLevel?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {orgLevel ? (
              <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                Org-level credentials
              </span>
            ) : null}
          </div>
          {onExport && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={exportDisabled}
            >
              Export CSV
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function NotConfigured({ service }: { service: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      {service} credentials not configured.{" "}
      <Link
        href="/dashboard/settings/analytics"
        className="underline hover:text-foreground"
      >
        Connect {service} →
      </Link>
    </p>
  );
}

function Loading() {
  return <p className="text-sm text-muted-foreground">Loading…</p>;
}

function ErrorMsg({ msg }: { msg: string }) {
  return <p className="text-sm text-destructive">{msg}</p>;
}

// ── metric tile ───────────────────────────────────────────────────────────────

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
    </div>
  );
}

// ── Paid section ──────────────────────────────────────────────────────────────

type AdsSummary = {
  spend: number;
  clicks: number;
  conversions: number;
  averageCpc: number;
  currency: string;
};

function PaidSection({
  clientId,
  range,
}: {
  clientId: string;
  range: string;
}) {
  const [data, setData] = useState<AdsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const days =
        range === "7d" ? "7" : range === "90d" ? "90" : "28";
      // Look up the google-ads customerId linked to this clientId
      const connRes = await fetch(
        `/api/google-ads/connections?clientId=${encodeURIComponent(clientId)}`
      );
      if (!connRes.ok) {
        setNotConfigured(true);
        return;
      }
      const conns = (await connRes.json()) as { googleAdsCustomerId: string }[];
      if (!conns.length) {
        setNotConfigured(true);
        return;
      }
      const customerId = conns[0].googleAdsCustomerId;
      const dashRes = await fetch(
        `/api/google-ads/dashboard?customerId=${customerId}&days=${days}`
      );
      if (!dashRes.ok) {
        setNotConfigured(true);
        return;
      }
      const dash = await dashRes.json();
      setData({
        spend: dash.summary?.cost ?? 0,
        clicks: dash.summary?.clicks ?? 0,
        conversions: dash.summary?.conversions ?? 0,
        averageCpc: dash.summary?.averageCpc ?? 0,
        currency: dash.account?.currencyCode ?? "GBP",
      });
      setLastRefresh(new Date());
    } catch {
      setError("Failed to load Paid data");
    } finally {
      setLoading(false);
    }
  }, [clientId, range]);

  useEffect(() => {
    void load();
  }, [load]);

  const currency = data?.currency ?? "GBP";
  const money = (v: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v); // already in display units (microsToUnits applied by dashboard API)

  function exportCsv() {
    if (!data) return;
    downloadCsv("paid-performance.csv", [
      ["Metric", "Value"],
      ["Spend", String(data.spend)],
      ["Clicks", String(data.clicks)],
      ["Conversions", String(data.conversions)],
      ["Avg CPC", String(data.averageCpc)],
    ]);
  }

  const connectionStatus = deriveConnectionState(
    notConfigured,
    loading,
    error,
    !!data,
    lastRefresh
  );

  return (
    <SectionShell
      title="Paid Performance"
      onExport={data ? exportCsv : undefined}
      exportDisabled={!data}
    >
      <div className="mb-4">
        <ConnectionStateIndicator service="Google Ads" status={connectionStatus} />
      </div>
      {loading && <Loading />}
      {!loading && notConfigured && (
        <p className="text-sm text-muted-foreground">
          No Google Ads account linked to this client.{" "}
          <Link
            href="/dashboard/google-ads/settings"
            className="underline hover:text-foreground"
          >
            Connect Ads account →
          </Link>
        </p>
      )}
      {!loading && error && <ErrorMsg msg={error} />}
      {!loading && data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricTile label="Spend" value={money(data.spend)} />
          <MetricTile label="Clicks" value={fmt(data.clicks)} />
          <MetricTile label="Conversions" value={fmt(data.conversions)} />
          <MetricTile label="Avg CPC" value={money(data.averageCpc)} />
        </div>
      )}
    </SectionShell>
  );
}

// ── Organic / GSC section ─────────────────────────────────────────────────────

function OrganicSection({
  clientId,
  range,
}: {
  clientId: string;
  range: string;
}) {
  const [queries, setQueries] = useState<GscQueryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [orgLevel, setOrgLevel] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const q = new URLSearchParams({ clientId, range });
      const res = await fetch(`/api/analytics/gsc/queries?${q}`);
      const json = await res.json();
      if (res.status === 404 && json.notConfigured) {
        setNotConfigured(true);
        return;
      }
      if (!res.ok) {
        setError(json.error ?? "Failed to load GSC data");
        return;
      }
      setQueries(json.queries as GscQueryRow[]);
      setOrgLevel(Boolean(json.isOrgLevel));
      setLastRefresh(new Date());
    } catch {
      setError("Failed to load Organic data");
    } finally {
      setLoading(false);
    }
  }, [clientId, range]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    downloadCsv("organic-queries.csv", [
      ["Query", "Clicks", "Impressions", "CTR", "Avg Position"],
      ...queries.map((r) => [
        r.query,
        String(r.clicks),
        String(r.impressions),
        pct(r.ctr),
        r.position.toFixed(1),
      ]),
    ]);
  }

  const connectionStatus = deriveConnectionState(
    notConfigured,
    loading,
    error,
    queries.length > 0,
    lastRefresh
  );

  return (
    <SectionShell
      title="Organic Search (Search Console)"
      onExport={queries.length > 0 ? exportCsv : undefined}
      exportDisabled={queries.length === 0}
      orgLevel={orgLevel}
    >
      <div className="mb-4">
        <ConnectionStateIndicator service="Search Console" status={connectionStatus} />
      </div>
      {loading && <Loading />}
      {!loading && notConfigured && (
        <NotConfigured service="Search Console" />
      )}
      {!loading && error && <ErrorMsg msg={error} />}
      {!loading && !notConfigured && !error && queries.length === 0 && (
        <p className="text-sm text-muted-foreground">No query data for this period.</p>
      )}
      {!loading && queries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Query</th>
                <th className="py-2 pr-3">Clicks</th>
                <th className="py-2 pr-3">Impr.</th>
                <th className="py-2 pr-3">CTR</th>
                <th className="py-2 pr-3">Position</th>
              </tr>
            </thead>
            <tbody>
              {queries.map((r, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2 pr-3 font-medium">{r.query}</td>
                  <td className="py-2 pr-3">{fmt(r.clicks)}</td>
                  <td className="py-2 pr-3">{fmt(r.impressions)}</td>
                  <td className="py-2 pr-3">{pct(r.ctr)}</td>
                  <td className="py-2 pr-3">{r.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionShell>
  );
}

// ── Traffic / GA4 section ─────────────────────────────────────────────────────

function TrafficSection({
  clientId,
  range,
}: {
  clientId: string;
  range: string;
}) {
  const [overview, setOverview] = useState<Ga4OverviewResult | null>(null);
  const [pages, setPages] = useState<Ga4PageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [orgLevel, setOrgLevel] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const q = new URLSearchParams({ clientId, range });
      const [overRes, pagesRes] = await Promise.all([
        fetch(`/api/analytics/ga4/overview?${q}`),
        fetch(`/api/analytics/ga4/pages?${q}`),
      ]);
      if (overRes.status === 404) {
        const j = await overRes.json();
        if (j.notConfigured) {
          setNotConfigured(true);
          return;
        }
      }
      if (!overRes.ok) {
        const j = await overRes.json();
        setError(j.error ?? "Failed to load GA4 data");
        return;
      }
      const [overData, pagesData] = await Promise.all([
        overRes.json(),
        pagesRes.ok ? pagesRes.json() : Promise.resolve({ pages: [] }),
      ]);
      setOverview(overData as Ga4OverviewResult);
      setOrgLevel(Boolean((overData as { isOrgLevel?: boolean }).isOrgLevel));
      setPages((pagesData.pages as Ga4PageRow[]) ?? []);
      setLastRefresh(new Date());
    } catch {
      setError("Failed to load Traffic data");
    } finally {
      setLoading(false);
    }
  }, [clientId, range]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    const rows: string[][] = [
      ["Metric", "Value"],
      ["Sessions", String(overview?.sessions ?? "")],
      ["Users", String(overview?.users ?? "")],
      ["Pageviews", String(overview?.pageviews ?? "")],
      ["Conversions", String(overview?.conversions ?? "")],
      ["Bounce Rate", pct(overview?.bounceRate ?? 0)],
      [],
      ["Page", "Sessions", "Conversions"],
      ...pages.map((p) => [p.path, String(p.sessions), String(p.conversions)]),
    ];
    downloadCsv("website-traffic.csv", rows);
  }

  const connectionStatus = deriveConnectionState(
    notConfigured,
    loading,
    error,
    !!overview,
    lastRefresh
  );

  return (
    <SectionShell
      title="Website Traffic (GA4)"
      onExport={overview ? exportCsv : undefined}
      exportDisabled={!overview}
      orgLevel={orgLevel}
    >
      <div className="mb-4">
        <ConnectionStateIndicator service="GA4" status={connectionStatus} />
      </div>
      {loading && <Loading />}
      {!loading && notConfigured && <NotConfigured service="GA4" />}
      {!loading && error && <ErrorMsg msg={error} />}
      {!loading && overview && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <MetricTile label="Sessions" value={fmt(overview.sessions)} />
            <MetricTile label="Users" value={fmt(overview.users)} />
            <MetricTile label="Pageviews" value={fmt(overview.pageviews)} />
            <MetricTile label="Conversions" value={fmt(overview.conversions)} />
            <MetricTile label="Bounce Rate" value={pct(overview.bounceRate)} />
          </div>

          {pages.length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Top pages
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">Page</th>
                    <th className="py-2 pr-3">Sessions</th>
                    <th className="py-2 pr-3">Conversions</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2 pr-3 font-mono text-xs">{p.path}</td>
                      <td className="py-2 pr-3">{fmt(p.sessions)}</td>
                      <td className="py-2 pr-3">{fmt(p.conversions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </SectionShell>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function ReportingView({
  clients,
  initialClientId,
}: {
  clients: { id: string; name: string }[];
  initialClientId?: string;
}) {
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [range, setRange] = useState("28d");

  const hasClient = clientId.length > 0;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[220px]">
              <label className="text-sm font-medium">Client</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-background"
              >
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-36">
              <label className="text-sm font-medium">Date range</label>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-background"
              >
                {Object.entries(RANGE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <Link
              href="/dashboard/settings/analytics"
              className="text-sm text-muted-foreground underline hover:text-foreground ml-auto"
            >
              Settings
            </Link>
          </div>
        </CardContent>
      </Card>

      {!hasClient && (
        <p className="text-sm text-muted-foreground">
          Select a client above to load their reporting data.
        </p>
      )}

      {hasClient && (
        <>
          <PaidSection clientId={clientId} range={range} />
          <OrganicSection clientId={clientId} range={range} />
          <TrafficSection clientId={clientId} range={range} />
        </>
      )}
    </div>
  );
}
