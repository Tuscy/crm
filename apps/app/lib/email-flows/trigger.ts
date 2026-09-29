"use server";

import { waitUntil } from "@vercel/functions";
import { prisma } from "@stky/db";
import type { EmailFlowTrigger, Prisma } from "@stky/db";
import { logStky } from "@/lib/observability";
import { n8nWebhookUrl } from "./n8n-client";

type ContactRef = { leadId?: string | null; clientId?: string | null };

/** Plain JSON-serialisable copy of a record (Dates → ISO strings). */
function toSnapshot(record: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(record ?? {})) as Record<string, unknown>;
}

/**
 * Enrols a single lead or client into a flow. Enforces the invariant that
 * exactly one of leadId / clientId is set — never both, never neither.
 * Snapshots the contact data and kicks off the n8n workflow via its webhook.
 */
export async function enrolInFlow(flowId: string, contact: ContactRef) {
  const leadId = contact.leadId || null;
  const clientId = contact.clientId || null;

  if (Boolean(leadId) === Boolean(clientId)) {
    throw new Error(
      "Enrollment requires exactly one of leadId or clientId (never both, never neither)."
    );
  }

  const flow = await prisma.emailFlow.findUnique({ where: { id: flowId } });
  if (!flow) throw new Error("Flow not found");
  if (!flow.active || !flow.n8nWorkflowId || !flow.n8nWebhookPath) {
    throw new Error("Flow is not active");
  }
  const n8nWebhookPath = flow.n8nWebhookPath;

  const contactData = leadId
    ? await prisma.lead.findUnique({ where: { id: leadId } })
    : await prisma.client.findUnique({ where: { id: clientId! } });

  if (!contactData) throw new Error("Contact not found");

  const snapshot = toSnapshot(contactData);

  const enrollment = await prisma.emailFlowEnrollment.create({
    data: {
      flowId,
      leadId,
      clientId,
      contactSnapshot: snapshot as Prisma.InputJsonValue,
    },
  });

  // Kick off the n8n workflow via its webhook trigger. Deferred with waitUntil
  // so the originating CRM action returns immediately instead of waiting on
  // this third-party call — a bare unawaited fetch() would risk Vercel
  // freezing/terminating the function before the request completes.
  waitUntil(
    (async () => {
      try {
        const res = await fetch(n8nWebhookUrl(n8nWebhookPath), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrollmentId: enrollment.id, contact: snapshot }),
        });
        if (!res.ok) {
          throw new Error(`n8n webhook returned ${res.status}`);
        }
      } catch (e) {
        // Mark the enrollment failed but never throw here — the originating
        // CRM action has already returned by the time this runs.
        await prisma.emailFlowEnrollment.update({
          where: { id: enrollment.id },
          data: { status: "FAILED" },
        });
        logStky("flow_enrol_webhook_failed", {
          flowId,
          enrollmentId: enrollment.id,
          error: e instanceof Error ? e.message : "unknown",
        });
      }
    })()
  );

  return enrollment;
}

function triggerConfigMatches(
  triggerConfig: unknown,
  context: Record<string, string | undefined>
): boolean {
  if (!triggerConfig || typeof triggerConfig !== "object") return true;
  const cfg = triggerConfig as Record<string, unknown>;
  // Only enforce keys that are present in the config.
  if (typeof cfg.stage === "string" && cfg.stage) {
    if (context.stage !== cfg.stage) return false;
  }
  if (typeof cfg.status === "string" && cfg.status) {
    if (context.status !== cfg.status) return false;
  }
  return true;
}

/**
 * Finds all active flows for a given trigger (optionally filtered by trigger
 * config such as a target stage/status) and enrols the contact into each.
 * Best-effort: failures are logged, never thrown, so the originating CRM
 * action (lead/client/deal/task) always succeeds.
 */
export async function enrolMatchingFlows(
  trigger: EmailFlowTrigger,
  contact: ContactRef,
  context: Record<string, string | undefined> = {}
): Promise<void> {
  try {
    const flows = await prisma.emailFlow.findMany({
      where: { active: true, trigger },
    });
    for (const flow of flows) {
      if (!triggerConfigMatches(flow.triggerConfig, context)) continue;
      try {
        await enrolInFlow(flow.id, contact);
      } catch (e) {
        logStky("flow_auto_enrol_failed", {
          flowId: flow.id,
          trigger,
          error: e instanceof Error ? e.message : "unknown",
        });
      }
    }
  } catch (e) {
    logStky("flow_auto_enrol_lookup_failed", {
      trigger,
      error: e instanceof Error ? e.message : "unknown",
    });
  }
}
