import { OAuth2Client } from "google-auth-library";
import { searchconsole } from "googleapis/build/src/apis/searchconsole";

export type GscQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0–1
  position: number;
};

export type GscPageRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0–1
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

function rangeToGscDates(range: string): { startDate: string; endDate: string } {
  const daysMap: Record<string, number> = { "7d": 7, "28d": 28, "90d": 90 };
  const days = daysMap[range] ?? 28;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

export async function fetchGscQueries(
  siteUrl: string,
  refreshToken: string,
  range: string
): Promise<GscQueryRow[]> {
  const auth = makeAuthClient(refreshToken);
  const sc = searchconsole({ version: "v1", auth });
  const { startDate, endDate } = rangeToGscDates(range);

  const res = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: 10,
      dataState: "all",
    },
  });

  return (
    res.data.rows?.map((r) => ({
      query: r.keys?.[0] ?? "",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    })) ?? []
  );
}

export async function fetchGscPages(
  siteUrl: string,
  refreshToken: string,
  range: string
): Promise<GscPageRow[]> {
  const auth = makeAuthClient(refreshToken);
  const sc = searchconsole({ version: "v1", auth });
  const { startDate, endDate } = rangeToGscDates(range);

  const res = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["page"],
      rowLimit: 10,
      dataState: "all",
    },
  });

  return (
    res.data.rows?.map((r) => ({
      page: r.keys?.[0] ?? "",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
    })) ?? []
  );
}
