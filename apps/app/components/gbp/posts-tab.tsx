"use client";

import { useCan } from "@/lib/use-can";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardContent } from "@stky/ui";
import { NotConfigured } from "./business-profile-view";

type PostRow = {
  id: string;
  type: "STANDARD" | "EVENT" | "OFFER";
  summary: string;
  ctaType: string | null;
  ctaUrl: string | null;
  eventTitle: string | null;
  eventStart: string | null;
  eventEnd: string | null;
  offerTitle: string | null;
  offerCode: string | null;
  state: string;
  createTime: string;
  searchUrl: string | null;
};

const MAX_SUMMARY = 1500;

const CTA_TYPES = [
  ["CALL", "Call"],
  ["LEARN_MORE", "Learn more"],
  ["ORDER", "Order"],
  ["SIGN_UP", "Sign up"],
  ["BUY", "Buy"],
  ["BOOK", "Book"],
] as const;

const TYPE_BADGES: Record<string, string> = {
  STANDARD: "bg-muted text-muted-foreground",
  EVENT: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  OFFER: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

const STATE_BADGES: Record<string, string> = {
  LIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  PROCESSING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  DELETED: "bg-muted text-muted-foreground line-through",
};

const inputClass =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const labelClass = "text-sm font-medium";

function NewPostModal({
  clientId,
  onClose,
  onCreated,
}: {
  clientId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState<"STANDARD" | "EVENT" | "OFFER">("STANDARD");
  const [summary, setSummary] = useState("");
  const [ctaEnabled, setCtaEnabled] = useState(false);
  const [ctaType, setCtaType] = useState("LEARN_MORE");
  const [ctaUrl, setCtaUrl] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [offerTitle, setOfferTitle] = useState("");
  const [offerCode, setOfferCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const valid =
    summary.trim().length > 0 &&
    summary.length <= MAX_SUMMARY &&
    (type !== "EVENT" || (eventTitle.trim() && eventStart && eventEnd)) &&
    (type !== "OFFER" || offerTitle.trim()) &&
    (!ctaEnabled || ctaType === "CALL" || ctaUrl.trim());

  async function publish() {
    setBusy(true);
    try {
      const res = await fetch("/api/gbp/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          type,
          summary: summary.trim(),
          ctaType: ctaEnabled ? ctaType : undefined,
          ctaUrl: ctaEnabled && ctaUrl.trim() ? ctaUrl.trim() : undefined,
          eventTitle: type === "EVENT" ? eventTitle.trim() : undefined,
          eventStart:
            type === "EVENT" && eventStart
              ? new Date(eventStart).toISOString()
              : type === "OFFER" && eventStart
              ? new Date(eventStart).toISOString()
              : undefined,
          eventEnd:
            (type === "EVENT" || type === "OFFER") && eventEnd
              ? new Date(eventEnd).toISOString()
              : undefined,
          offerTitle: type === "OFFER" ? offerTitle.trim() : undefined,
          offerCode:
            type === "OFFER" && offerCode.trim() ? offerCode.trim() : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to publish post");
      toast.success("Post published");
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to publish post");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-2xl rounded-lg border border-border bg-background p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New post</h2>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Close
          </Button>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Post type</label>
              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as "STANDARD" | "EVENT" | "OFFER")
                }
                className={inputClass}
              >
                <option value="STANDARD">Standard</option>
                <option value="EVENT">Event</option>
                <option value="OFFER">Offer</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Body text</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={6}
                maxLength={MAX_SUMMARY}
                placeholder="What do you want to share?"
                className={inputClass}
              />
              <p
                className={`mt-1 text-xs ${
                  summary.length >= MAX_SUMMARY
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {summary.length} / {MAX_SUMMARY}
              </p>
            </div>

            {type === "EVENT" && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div>
                  <label className={labelClass}>Event title *</label>
                  <input
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Starts *</label>
                  <input
                    type="datetime-local"
                    value={eventStart}
                    onChange={(e) => setEventStart(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Ends *</label>
                  <input
                    type="datetime-local"
                    value={eventEnd}
                    onChange={(e) => setEventEnd(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {type === "OFFER" && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div>
                  <label className={labelClass}>Offer title *</label>
                  <input
                    value={offerTitle}
                    onChange={(e) => setOfferTitle(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Coupon code (optional)</label>
                  <input
                    value={offerCode}
                    onChange={(e) => setOfferCode(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={ctaEnabled}
                  onChange={(e) => setCtaEnabled(e.target.checked)}
                />
                Add a call-to-action button
              </label>
              {ctaEnabled && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <div>
                    <label className={labelClass}>CTA type</label>
                    <select
                      value={ctaType}
                      onChange={(e) => setCtaType(e.target.value)}
                      className={inputClass}
                    >
                      {CTA_TYPES.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {ctaType !== "CALL" && (
                    <div>
                      <label className={labelClass}>URL *</label>
                      <input
                        type="url"
                        value={ctaUrl}
                        onChange={(e) => setCtaUrl(e.target.value)}
                        placeholder="https://…"
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Preview pane */}
          <div>
            <p className={labelClass}>Preview</p>
            <div className="mt-1 rounded-lg border border-border p-4 space-y-2 bg-card">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  TYPE_BADGES[type]
                }`}
              >
                {type === "STANDARD" ? "Update" : type === "EVENT" ? "Event" : "Offer"}
              </span>
              {type === "EVENT" && eventTitle && (
                <p className="font-semibold text-sm">{eventTitle}</p>
              )}
              {type === "OFFER" && offerTitle && (
                <p className="font-semibold text-sm">{offerTitle}</p>
              )}
              {type === "EVENT" && eventStart && (
                <p className="text-xs text-muted-foreground">
                  {new Date(eventStart).toLocaleString()}
                  {eventEnd ? ` – ${new Date(eventEnd).toLocaleString()}` : ""}
                </p>
              )}
              <p className="text-sm whitespace-pre-wrap">
                {summary || (
                  <span className="text-muted-foreground italic">
                    Post body will appear here…
                  </span>
                )}
              </p>
              {type === "OFFER" && offerCode && (
                <p className="text-xs font-mono rounded bg-muted px-2 py-1 inline-block">
                  Code: {offerCode}
                </p>
              )}
              {ctaEnabled && (
                <span className="inline-block rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                  {CTA_TYPES.find(([v]) => v === ctaType)?.[1] ?? ctaType}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button disabled={!valid || busy} onClick={() => setConfirming(true)}>
            Publish post
          </Button>
        </div>

        {confirming && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 space-y-4">
              <p className="font-medium">Publish this post to Google?</p>
              <p className="text-sm text-muted-foreground">
                The post will appear publicly on the Business Profile. It can be
                deleted later but edits require deleting and re-posting.
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
                <Button size="sm" disabled={busy} onClick={() => void publish()}>
                  {busy ? "Publishing…" : "Confirm & publish"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PostsTab({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string | null;
}) {
  const [posts, setPosts] = useState<PostRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/gbp/posts?clientId=${encodeURIComponent(clientId)}`
      );
      const json = (await res.json()) as {
        posts?: PostRow[];
        notConfigured?: boolean;
        error?: string;
      };
      if (res.status === 404 && json.notConfigured) {
        setNotConfigured(true);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Failed to load posts");
      setPosts(json.posts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canDelete = useCan("gbp:delete");
  async function handleDelete(post: PostRow) {
    if (
      !window.confirm(
        "Delete this post? It will be removed from the Business Profile on Google."
      )
    ) {
      return;
    }
    setDeletingId(post.id);
    try {
      const res = await fetch(`/api/gbp/posts/${post.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to delete post");
      toast.success("Post deleted");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete post");
    } finally {
      setDeletingId(null);
    }
  }

  if (!clientId) {
    return (
      <p className="text-sm text-muted-foreground py-8">
        Select a client above to manage posts. Posts are cached per client, so
        an org-level view isn&apos;t available here.
      </p>
    );
  }
  if (notConfigured) return <NotConfigured clientName={clientName} />;
  if (loading && posts === null) {
    return <p className="text-sm text-muted-foreground py-8">Loading posts…</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-destructive py-8" role="alert">
        {error}
      </p>
    );
  }

  const visible = posts ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {visible.length === 0
            ? "No posts yet."
            : `${visible.length} post${visible.length !== 1 ? "s" : ""}`}
          {loading ? " · Refreshing…" : ""}
        </p>
        <Button size="sm" onClick={() => setShowNew(true)}>
          New post
        </Button>
      </div>

      {visible.length > 0 && (
        <div className="space-y-3">
          {visible.map((post) => (
            <Card key={post.id}>
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        TYPE_BADGES[post.type] ?? TYPE_BADGES.STANDARD
                      }`}
                    >
                      {post.type === "STANDARD"
                        ? "Standard"
                        : post.type === "EVENT"
                        ? "Event"
                        : "Offer"}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATE_BADGES[post.state] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {post.state}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(post.createTime).toLocaleDateString()}
                    </span>
                  </div>
                  {(post.eventTitle || post.offerTitle) && (
                    <p className="text-sm font-medium">
                      {post.eventTitle ?? post.offerTitle}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {post.summary}
                  </p>
                  {post.searchUrl && (
                    <a
                      href={post.searchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline text-muted-foreground hover:text-foreground"
                    >
                      View on Google →
                    </a>
                  )}
                </div>
                {canDelete && post.state !== "DELETED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={deletingId === post.id}
                    onClick={() => void handleDelete(post)}
                  >
                    {deletingId === post.id ? "Deleting…" : "Delete"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showNew && (
        <NewPostModal
          clientId={clientId}
          onClose={() => setShowNew(false)}
          onCreated={() => void load()}
        />
      )}
    </div>
  );
}
