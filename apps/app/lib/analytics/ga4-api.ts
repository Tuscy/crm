import { OAuth2Client } from "google-auth-library";
import { analyticsdata } from "googleapis/build/src/apis/analyticsdata";
import { normaliseGa4PropertyId } from "./credentials";

export type Ga4OverviewResult = {
  sessions: number;
  users: number;
  pageviews: number;
  conversions: number;
  bounceRate: number; // 0–1
};

export type Ga4PageRow = {
  path: string;
  sessions: number;
  conversions: number;
};

function makeAuthClient(refreshToken: string) {
  const auth = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  );
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

function rangeToGa4Dates(range: string): { startDate: string; endDate: string } {
  const map: Record<string, string> = {
    "7d": "7daysAgo",
    "28d": "28daysAgo",
    "90d": "90daysAgo",
  };
  return { startDate: map[range] ?? "28daysAgo", endDate: "today" };
}

function num(v: string | null | undefined): number {
  return Number(v ?? 0);
}

export async function fetchGa4Overview(
  accountId: string,
  refreshToken: string,
  range: string
): Promise<Ga4OverviewResult> {
  const auth = makeAuthClient(refreshToken);
  const api = analyticsdata({ version: "v1beta", auth });
  const property = normaliseGa4PropertyId(accountId);
  const { startDate, endDate } = rangeToGa4Dates(range);

  const res = await api.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "screenPageViews" },
        { name: "conversions" },
        { name: "bounceRate" },
      ],
    },
  });

  const row = res.data.rows?.[0];
  const vals = row?.metricValues ?? [];
  return {
    sessions: num(vals[0]?.value),
    users: num(vals[1]?.value),
    pageviews: num(vals[2]?.value),
    conversions: num(vals[3]?.value),
    bounceRate: num(vals[4]?.value),
  };
}

export async function fetchGa4Pages(
  accountId: string,
  refreshToken: string,
  range: string
): Promise<Ga4PageRow[]> {
  const auth = makeAuthClient(refreshToken);
  const api = analyticsdata({ version: "v1beta", auth });
  const property = normaliseGa4PropertyId(accountId);
  const { startDate, endDate } = rangeToGa4Dates(range);

  const res = await api.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "sessions" }, { name: "conversions" }],
      limit: "10",
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    },
  });

  return (
    res.data.rows?.map((r) => ({
      path: r.dimensionValues?.[0]?.value ?? "",
      sessions: num(r.metricValues?.[0]?.value),
      conversions: num(r.metricValues?.[1]?.value),
    })) ?? []
  );
}
