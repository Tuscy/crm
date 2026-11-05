"use server";

import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@stky/db";
import type { EmailFlowTrigger } from "@stky/db";
import { auth } from "@/auth";
import type { FlowStep } from "./types";
import { requirePermission } from "@/lib/server/guard";

async function requireStaff() {
  const session = await auth();
  if (!session?.user?.isStaff) {
    throw new Error("Staff session required");
  }
  return session;
}

export async function listEmailFlows() {
  await requireStaff();
  const flows = await prisma.emailFlow.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          enrollments: { where: { status: "ACTIVE" } },
        },
      },
    },
  });
  return flows;
}

export async function getEmailFlowById(id: string) {
  await requireStaff();
  return prisma.emailFlow.findUnique({ where: { id } });
}

/** Creates a blank draft flow and returns it — used by the "New flow" button. */
export async function createEmailFlow() {
  await requirePermission("emailFlow:create", { entity: "EmailFlow" });
  await requireStaff();
  const flow = await prisma.emailFlow.create({
    data: {
      name: "Untitled flow",
      trigger: "MANUAL",
      steps: [],
      active: false,
    },
  });
  revalidatePath("/dashboard/email-flows");
  return flow;
}

export type UpdateFlowInput = {
  name?: string;
  description?: string | null;
  trigger?: EmailFlowTrigger;
  triggerConfig?: Record<string, unknown> | null;
  steps?: FlowStep[];
};

/**
 * Saves flow metadata and/or its step list. This is a draft-level save — it
 * never touches n8n. Activation is handled separately (see activation.ts).
 */
export async function updateEmailFlow(id: string, input: UpdateFlowInput) {
  await requirePermission("emailFlow:update", { entity: "EmailFlow", entityId: id });
  await requireStaff();

  const data: Prisma.EmailFlowUpdateInput = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Flow name is required");
    data.name = name;
  }
  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
  }
  if (input.trigger !== undefined) {
    data.trigger = input.trigger;
  }
  if (input.triggerConfig !== undefined) {
    data.triggerConfig =
      input.triggerConfig === null
        ? Prisma.JsonNull
        : (input.triggerConfig as Prisma.InputJsonValue);
  }
  if (input.steps !== undefined) {
    data.steps = input.steps as unknown as Prisma.InputJsonValue;
  }

  const flow = await prisma.emailFlow.update({ where: { id }, data });

  revalidatePath("/dashboard/email-flows");
  revalidatePath(`/dashboard/email-flows/${id}`);
  return flow;
}

export async function deleteEmailFlow(id: string) {
  await requirePermission("emailFlow:delete", { entity: "EmailFlow", entityId: id });
  await requireStaff();

  const flow = await prisma.emailFlow.findUnique({ where: { id } });
  if (!flow) return;

  // Best-effort: remove the compiled workflow from n8n so we don't orphan it.
  if (flow.n8nWorkflowId) {
    try {
      const { deleteN8nWorkflow } = await import("./n8n-client");
      await deleteN8nWorkflow(flow.n8nWorkflowId);
    } catch {
      // n8n cleanup is best-effort — proceed with DB delete regardless.
    }
  }

  await prisma.emailFlow.delete({ where: { id } });
  revalidatePath("/dashboard/email-flows");
}
