"use server";

import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/auth";
import {
  listN8nWorkflows,
  n8nConfigured,
  setN8nWorkflowActive,
  type N8nWorkflowSummary,
} from "@/lib/n8n/client";
import { requirePermission } from "@/lib/server/guard";

export async function getAutomationsWorkflows(): Promise<{
  configured: boolean;
  workflows: N8nWorkflowSummary[];
  error: string | null;
}> {
  await requireStaffSession();
  if (!n8nConfigured()) {
    return { configured: false, workflows: [], error: null };
  }
  try {
    const workflows = await listN8nWorkflows();
    return { configured: true, workflows, error: null };
  } catch (e) {
    return {
      configured: true,
      workflows: [],
      error: e instanceof Error ? e.message : "Failed to load workflows",
    };
  }
}

export async function toggleN8nWorkflowActive(
  workflowId: string,
  active: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission("emailFlow:update", { entity: "N8nWorkflow" });
  try {
    await requireStaffSession();
    if (!n8nConfigured()) {
      return { ok: false, error: "n8n is not configured (N8N_BASE_URL / N8N_API_KEY)." };
    }
    await setN8nWorkflowActive(workflowId, active);
    revalidatePath("/dashboard/automations");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update workflow",
    };
  }
}
