"use client";

import { useCan } from "@/lib/use-can";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardContent } from "@stky/ui";
import { NotConfigured } from "./business-profile-view";

type Review = {
  reviewId: string;
  reviewer: { displayName: string; isAnonymous?: boolean };
  starRating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: { comment: string; updateTime: string };
};

type ReviewsResponse = {
  reviews: Review[];
  nextPageToken?: string;
  averageRating: number;
  totalReviewCount: number;
  notConfigured?: boolean;
  error?: string;
};

const STAR_VALUES: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

type Filter = "all" | "unreplied" | "1" | "2" | "3" | "4" | "5";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(rating)}
      <span className="text-muted-foreground/30">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function ReviewCard({
  review,
  clientId,
  onReplied,
}: {
  review: Review;
  clientId: string;
  onReplied: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review.reviewReply?.comment ?? "");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const rating = STAR_VALUES[review.starRating] ?? 0;
  const hasReply = Boolean(review.reviewReply);

  async function submitReply() {
    setBusy(true);
    try {
      const res = await fetch(`/api/gbp/reviews/${review.reviewId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientId || null, comment: draft }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to post reply");
      toast.success("Reply posted");
      setConfirming(false);
      setEditing(false);
      onReplied();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post reply");
    } finally {
      setBusy(false);
    }
  }

  const canDelete = useCan("gbp:delete");
  async function deleteReply() {
    if (!window.confirm("Delete this reply? It will be removed from Google.")) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/gbp/reviews/${review.reviewId}/reply${
          clientId ? `?clientId=${encodeURIComponent(clientId)}` : ""
        }`,
        { method: "DELETE" }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to delete reply");
      toast.success("Reply deleted");
      onReplied();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete reply");
    } finally {
      setBusy(false);
    }
  }

  const initial = review.reviewer.displayName?.charAt(0).toUpperCase() || "?";

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="font-medium text-sm">
                {review.reviewer.displayName || "Anonymous"}
              </span>
              <Stars rating={rating} />
              <span className="text-xs text-muted-foreground">
                {new Date(review.createTime).toLocaleDateString()}
              </span>
            </div>
            {review.comment ? (
              <p className="mt-1 text-sm whitespace-pre-wrap">{review.comment}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground italic">
                No written review.
              </p>
            )}
          </div>
        </div>

        {hasReply && !editing ? (
          <div className="ml-12 rounded-md bg-muted/60 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Your reply ·{" "}
              {new Date(review.reviewReply!.updateTime).toLocaleDateString()}
            </p>
            <p className="text-sm whitespace-pre-wrap">
              {review.reviewReply!.comment}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setDraft(review.reviewReply!.comment);
                  setEditing(true);
                }}
              >
                Edit
              </Button>
              {canDelete && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void deleteReply()}>
                  Delete
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="ml-12 space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="Write a public reply…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy || !draft.trim()}
                onClick={() => setConfirming(true)}
              >
                {hasReply ? "Update reply" : "Post reply"}
              </Button>
              {editing && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {confirming && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 space-y-4">
              <p className="font-medium">Post this reply publicly?</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md bg-muted p-3">
                {draft}
              </p>
              <p className="text-xs text-muted-foreground">
                This reply will be visible to everyone on Google.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" disabled={busy} onClick={() => void submitReply()}>
                  {busy ? "Posting…" : "Confirm & post"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReviewsTab({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string | null;
}) {
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  // Stack of page tokens for prev navigation; current page token is the last entry
  const [tokenStack, setTokenStack] = useState<(string | undefined)[]>([undefined]);

  const currentToken = tokenStack[tokenStack.length - 1];

  const load = useCallback(
    async (pageToken: string | undefined) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (clientId) params.set("clientId", clientId);
        if (pageToken) params.set("pageToken", pageToken);
        const res = await fetch(`/api/gbp/reviews?${params.toString()}`);
        const json = (await res.json()) as ReviewsResponse;
        if (res.status === 404 && json.notConfigured) {
          setNotConfigured(true);
          return;
        }
        if (!res.ok) throw new Error(json.error ?? "Failed to load reviews");
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load reviews");
      } finally {
        setLoading(false);
      }
    },
    [clientId]
  );

  useEffect(() => {
    void load(currentToken);
  }, [load, currentToken]);

  if (notConfigured) return <NotConfigured clientName={clientName} />;
  if (loading && !data) {
    return <p className="text-sm text-muted-foreground py-8">Loading reviews…</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-destructive py-8" role="alert">
        {error}
      </p>
    );
  }
  if (!data) return null;

  const unrepliedCount = data.reviews.filter((r) => !r.reviewReply).length;

  const filtered = data.reviews.filter((r) => {
    if (filter === "all") return true;
    if (filter === "unreplied") return !r.reviewReply;
    return STAR_VALUES[r.starRating] === Number(filter);
  });

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-6 rounded-md border border-border px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">
            {data.averageRating.toFixed(1)}
          </span>
          <Stars rating={Math.round(data.averageRating)} />
        </div>
        <div className="text-sm text-muted-foreground">
          {data.totalReviewCount} review{data.totalReviewCount !== 1 ? "s" : ""} total
        </div>
        <div className="text-sm text-muted-foreground">
          {unrepliedCount} unreplied on this page
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["unreplied", "Unreplied"],
            ["5", "5★"],
            ["4", "4★"],
            ["3", "3★"],
            ["2", "2★"],
            ["1", "1★"],
          ] as [Filter, string][]
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "outline"}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Review list */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">
          No reviews match this filter.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((review) => (
            <ReviewCard
              key={review.reviewId}
              review={review}
              clientId={clientId}
              onReplied={() => void load(currentToken)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          size="sm"
          variant="outline"
          disabled={tokenStack.length <= 1 || loading}
          onClick={() => setTokenStack((prev) => prev.slice(0, -1))}
        >
          ← Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!data.nextPageToken || loading}
          onClick={() =>
            setTokenStack((prev) => [...prev, data.nextPageToken])
          }
        >
          Next →
        </Button>
        {loading && (
          <span className="text-xs text-muted-foreground">Refreshing…</span>
        )}
      </div>
    </div>
  );
}
