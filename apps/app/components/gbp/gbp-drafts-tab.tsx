"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import { toast } from "sonner";
import {
  createGBPDraft,
  updateGBPDraft,
  approveGBPDraft,
  mockPostGBPDraft,
  getGBPDrafts,
  deleteGBPDraft,
} from "@/lib/server/actions/gbp-drafts";

type GBPDraft = {
  id: string;
  clientId: string;
  content: string;
  status: string;
  createdById: string;
  approvedById: string | null;
  approvedAt: Date | null;
  contentHash: string | null;
  createdAt: Date;
  updatedAt: Date;
  client: { id: string; name: string };
  createdBy: { id: string; name: string | null; email: string };
  approvedBy: { id: string; name: string | null; email: string } | null;
};

const MAX_LENGTH = 1500;

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  POSTED_MOCK: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

export function GBPDraftsTab({ clients }: { clients: { id: string; name: string }[] }) {
  const [drafts, setDrafts] = useState<GBPDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [selectedClient, setSelectedClient] = useState(clients[0]?.id ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGBPDrafts();
      setDrafts(data as GBPDraft[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load drafts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(content: string) {
    if (!selectedClient) {
      toast.error("Please select a client");
      return;
    }
    try {
      await createGBPDraft(selectedClient, content);
      toast.success("Draft created");
      setShowNew(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create draft");
    }
  }

  async function handleUpdate(id: string, content: string) {
    try {
      const result = await updateGBPDraft(id, content);
      if (result.approvalInvalidated) {
        toast.warning("Draft updated. Approval invalidated due to content change.");
      } else {
        toast.success("Draft updated");
      }
      setEditingId(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update draft");
    }
  }

  async function handleApprove(id: string) {
    if (!confirm("Approve this draft for mock posting?")) return;
    try {
      await approveGBPDraft(id);
      toast.success("Draft approved");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve draft");
    }
  }

  async function handleMockPost(id: string) {
    if (!confirm("Mock post this draft? (No actual Google API call will be made)")) return;
    try {
      await mockPostGBPDraft(id);
      toast.success("Mock posted successfully. No actual Google API call made.");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to mock post");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this draft?")) return;
    try {
      await deleteGBPDraft(id);
      toast.success("Draft deleted");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete draft");
    }
  }

  if (loading && drafts.length === 0) {
    return <p className="text-sm text-muted-foreground py-8">Loading drafts...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {drafts.length === 0
            ? "No drafts yet."
            : `${drafts.length} draft${drafts.length !== 1 ? "s" : ""}`}
        </p>
        <Button size="sm" onClick={() => setShowNew(true)}>
          New draft
        </Button>
      </div>

      {drafts.length > 0 && (
        <div className="space-y-3">
          {drafts.map((draft) => (
            <Card key={draft.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{draft.client.name}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                          STATUS_BADGE[draft.status] ?? STATUS_BADGE.DRAFT
                        }`}
                      >
                        {draft.status}
                      </span>
                      <span>Created by {draft.createdBy.name ?? draft.createdBy.email}</span>
                      <span>{new Date(draft.createdAt).toLocaleDateString("en-GB")}</span>
                    </div>
                    {draft.approvedBy && (
                      <p className="text-xs text-green-700 dark:text-green-400">
                        Approved by {draft.approvedBy.name ?? draft.approvedBy.email} on{" "}
                        {draft.approvedAt ? new Date(draft.approvedAt).toLocaleDateString("en-GB") : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {draft.status === "DRAFT" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(draft.id);
                            setEditContent(draft.content);
                          }}
                        >
                          Edit
                        </Button>
                        <Button size="sm" onClick={() => void handleApprove(draft.id)}>
                          Approve
                        </Button>
                      </>
                    )}
                    {draft.status === "APPROVED" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(draft.id);
                            setEditContent(draft.content);
                          }}
                        >
                          Edit (invalidates approval)
                        </Button>
                        <Button size="sm" onClick={() => void handleMockPost(draft.id)}>
                          Mock Post
                        </Button>
                      </>
                    )}
                    {draft.status === "POSTED_MOCK" && (
                      <span className="text-xs text-muted-foreground">Posted (mock)</span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleDelete(draft.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {editingId === draft.id ? (
                  <div className="space-y-3">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={6}
                      maxLength={MAX_LENGTH}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <div className="flex items-center justify-between">
                      <p className={`text-xs ${editContent.length >= MAX_LENGTH ? "text-destructive" : "text-muted-foreground"}`}>
                        {editContent.length} / {MAX_LENGTH}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => void handleUpdate(draft.id, editContent)}
                          disabled={editContent.trim().length === 0}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {draft.content}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showNew && (
        <NewDraftModal
          clients={clients}
          selectedClient={selectedClient}
          onClientChange={setSelectedClient}
          onClose={() => setShowNew(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

function NewDraftModal({
  clients,
  selectedClient,
  onClientChange,
  onClose,
  onCreate,
}: {
  clients: { id: string; name: string }[];
  selectedClient: string;
  onClientChange: (id: string) => void;
  onClose: () => void;
  onCreate: (content: string) => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    setBusy(true);
    try {
      await onCreate(content);
    } finally {
      setBusy(false);
    }
  }

  const valid = content.trim().length > 0 && content.length <= MAX_LENGTH && selectedClient;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-2xl rounded-lg border border-border bg-background p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New GBP Draft</h2>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Close
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Client</label>
            <select
              value={selectedClient}
              onChange={(e) => onClientChange(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={busy}
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Content (text only)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              maxLength={MAX_LENGTH}
              placeholder="What would you like to post?"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={busy}
            />
            <p
              className={`mt-1 text-xs ${
                content.length >= MAX_LENGTH
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {content.length} / {MAX_LENGTH}
            </p>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-900/20">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Mock posting only
            </p>
            <p className="text-amber-800 dark:text-amber-300 text-xs mt-1">
              This is a draft/review workflow with mock posting. No actual Google Business Profile API calls will be made. Approved drafts are marked as "POSTED_MOCK" for testing purposes.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button disabled={!valid || busy} onClick={() => void handleCreate()}>
            {busy ? "Creating..." : "Create Draft"}
          </Button>
        </div>
      </div>
    </div>
  );
}
