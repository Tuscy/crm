import { OAuth2Client } from "google-auth-library";
import { businessprofileperformance } from "googleapis/build/src/apis/businessprofileperformance";
import type {
  CreatePostInput,
  GBPInsightMetric,
  GBPInsights,
  GBPLocalPost,
  GBPReview,
  GBPReviewReply,
  GBPReviewsResult,
} from "./types";

/**
 * Reviews and local posts live on the My Business v4 REST API, which is not
 * bundled in the googleapis npm client — those calls go through the OAuth2
 * client's .request(). Insights use the current Business Profile Performance
 * API via businessprofileperformance().
 */
const V4_BASE = "https://mybusiness.googleapis.com/v4";

function makeAuthClient(refreshToken: string) {
  const auth = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  );
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

/** Extracts "locations/{id}" from "accounts/{a}/locations/{id}" for the performance API. */
function locationPath(locationName: string): string {
  const match = locationName.match(/locations\/[^/]+/);
  if (!match) throw new Error(`Invalid GBP location name: ${locationName}`);
  return match[0];
}

const STAR_VALUES: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

export function starRatingToNumber(rating: string): number {
  return STAR_VALUES[rating] ?? 0;
}

export async function listReviews(
  locationName: string,
  refreshToken: string,
  pageToken?: string
): Promise<GBPReviewsResult> {
  const auth = makeAuthClient(refreshToken);
  const url = new URL(`${V4_BASE}/${locationName}/reviews`);
  url.searchParams.set("pageSize", "50");
  url.searchParams.set("orderBy", "updateTime desc");
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const res = await auth.request<{
    reviews?: GBPReview[];
    nextPageToken?: string;
    averageRating?: number;
    totalReviewCount?: number;
  }>({ url: url.toString(), method: "GET" });

  return {
    reviews: res.data.reviews ?? [],
    nextPageToken: res.data.nextPageToken,
    averageRating: res.data.averageRating ?? 0,
    totalReviewCount: res.data.totalReviewCount ?? 0,
  };
}

/** Creates or updates the reply on a review (v4 reply endpoint is an upsert PUT). */
export async function replyToReview(
  locationName: string,
  reviewId: string,
  comment: string,
  refreshToken: string
): Promise<GBPReviewReply> {
  const auth = makeAuthClient(refreshToken);
  const res = await auth.request<GBPReviewReply>({
    url: `${V4_BASE}/${locationName}/reviews/${reviewId}/reply`,
    method: "PUT",
    data: { comment },
  });
  return res.data;
}

export async function deleteReviewReply(
  locationName: string,
  reviewId: string,
  refreshToken: string
): Promise<void> {
  const auth = makeAuthClient(refreshToken);
  await auth.request({
    url: `${V4_BASE}/${locationName}/reviews/${reviewId}/reply`,
    method: "DELETE",
  });
}

export async function listPosts(
  locationName: string,
  refreshToken: string
): Promise<GBPLocalPost[]> {
  const auth = makeAuthClient(refreshToken);
  const url = new URL(`${V4_BASE}/${locationName}/localPosts`);
  url.searchParams.set("pageSize", "100");

  const res = await auth.request<{
    localPosts?: GBPLocalPost[];
    nextPageToken?: string;
  }>({ url: url.toString(), method: "GET" });

  return res.data.localPosts ?? [];
}

function isoToGoogleDate(iso: string) {
  const d = new Date(iso);
  return {
    date: { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() },
    time: { hours: d.getHours(), minutes: d.getMinutes() },
  };
}

export async function createPost(
  locationName: string,
  input: CreatePostInput,
  refreshToken: string
): Promise<GBPLocalPost> {
  const auth = makeAuthClient(refreshToken);

  const body: Record<string, unknown> = {
    languageCode: "en-GB",
    topicType: input.type,
    summary: input.summary,
  };

  if (input.ctaType) {
    body.callToAction = {
      actionType: input.ctaType,
      ...(input.ctaUrl ? { url: input.ctaUrl } : {}),
    };
  }

  if (input.type === "EVENT" || input.type === "OFFER") {
    // Offers also use the event envelope for title + schedule in the v4 API
    const start = input.eventStart ? isoToGoogleDate(input.eventStart) : null;
    const end = input.eventEnd ? isoToGoogleDate(input.eventEnd) : null;
    body.event = {
      title: input.type === "OFFER" ? input.offerTitle : input.eventTitle,
      ...(start || end
        ? {
            schedule: {
              ...(start ? { startDate: start.date, startTime: start.time } : {}),
              ...(end ? { endDate: end.date, endTime: end.time } : {}),
            },
          }
        : {}),
    };
  }

  if (input.type === "OFFER" && input.offerCode) {
    body.offer = { couponCode: input.offerCode };
  }

  const res = await auth.request<GBPLocalPost>({
    url: `${V4_BASE}/${locationName}/localPosts`,
    method: "POST",
    data: body,
  });
  return res.data;
}

/** Deletes a post by its full resource name (accounts/{a}/locations/{l}/localPosts/{id}). */
export async function deletePost(
  postName: string,
  refreshToken: string
): Promise<void> {
  const auth = makeAuthClient(refreshToken);
  await auth.request({
    url: `${V4_BASE}/${postName}`,
    method: "DELETE",
  });
}

const INSIGHT_METRICS = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "CALL_CLICKS",
  "DIRECTION_REQUESTS",
  "WEBSITE_CLICKS",
  "BUSINESS_BOOKINGS",
  "BUSINESS_FOOD_ORDERS",
];

export async function getInsights(
  locationName: string,
  refreshToken: string,
  rangeDays: number
): Promise<GBPInsights> {
  const auth = makeAuthClient(refreshToken);
  const api = businessprofileperformance({ version: "v1", auth });

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - rangeDays);

  const res = await api.locations.fetchMultiDailyMetricsTimeSeries({
    location: locationPath(locationName),
    dailyMetrics: INSIGHT_METRICS,
    "dailyRange.startDate.year": start.getFullYear(),
    "dailyRange.startDate.month": start.getMonth() + 1,
    "dailyRange.startDate.day": start.getDate(),
    "dailyRange.endDate.year": end.getFullYear(),
    "dailyRange.endDate.month": end.getMonth() + 1,
    "dailyRange.endDate.day": end.getDate(),
  });

  const metrics: GBPInsightMetric[] = [];
  for (const multi of res.data.multiDailyMetricTimeSeries ?? []) {
    for (const entry of multi.dailyMetricTimeSeries ?? []) {
      const series =
        entry.timeSeries?.datedValues?.map((dv) => {
          const d = dv.date;
          const date = d
            ? `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`
            : "";
          return { date, value: Number(dv.value ?? 0) };
        }) ?? [];
      metrics.push({
        metric: entry.dailyMetric ?? "UNKNOWN",
        total: series.reduce((sum, p) => sum + p.value, 0),
        series,
      });
    }
  }

  return { metrics };
}
