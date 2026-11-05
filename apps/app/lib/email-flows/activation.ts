"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@stky/db";
import { auth } from "@/auth";
import { compileFlow } from "./compiler";
import {
  activateN8nWorkflow,
  createN8nWorkflow,
  deactivateN8nWorkflow,
  updateN8nWorkflow,
} from "./n8n-client";
import { parseSteps } from "./types";
import { renderTemplate } from "./template-utils";
import { sendFlowEmail } from "./send";
import { requirePermission } from "@/lib/server/guard";

async function requireStaff() {
  const session = await auth();
  if (!session?.user?.isStaff) {
    throw new Error("Staff session required");
  }
  return session;
}

function revalidateFlow(id: string) {
  revalidatePath("/dashboard/email-flows");
  revalidatePath(`/dashboard/email-flows/${id}`);
}

/**
 * Activates a flow: compile → push to n8n → activate → persist.
 *
 * Ordering guarantees (per spec):
 *  - The webhook path UUID is decided and persisted BEFORE the workflow id, so
 *    the URL embedded in the pushed workflow always matches what's stored.
 *  - n8nWorkflowId + active are only written AFTER n8n confirms success, so a
 *    failed n8n call never leaves a half-activated record.
 */
export async function activateEmailFlow(flowId: string) {
  await requirePermission("emailFlow:update", { entity: "EmailFlow", entityId: flowId });
  await requireStaff();

  const flow = await prisma.emailFlow.findUnique({ where: { id: flowId } });
  if (!flow) throw new Error("Flow not found");

  const steps = parseSteps(flow.steps);
  if (steps.length === 0) {
    throw new Error("Add at least one step before activating");
  }

  const { workflow, webhookPath } = compileFlow(
    { name: flow.name, steps },
    flow.n8nWebhookPath
  );

  // 1. Persist the webhook path first (idempotent — stable across re-activation).
  if (flow.n8nWebhookPath !== webhookPath) {
    await prisma.emailFlow.update({
      where: { id: flowId },
      data: { n8nWebhookPath: webhookPath },
    });
  }

  // 2. Push to n8n. If this throws, no workflowId/active is written below.
  let workflowId = flow.n8nWorkflowId;
  if (workflowId) {
    await updateN8nWorkflow(workflowId, workflow);
  } else {
    workflowId = await createN8nWorkflow(workflow);
  }
  await activateN8nWorkflow(workflowId);

  // 3. Only now mark the flow active and store the workflow id.
  const updated = await prisma.emailFlow.update({
    where: { id: flowId },
    data: { n8nWorkflowId: workflowId, active: true },
  });

  revalidateFlow(flowId);
  return updated;
}

export async function pauseEmailFlow(flowId: string) {
  await requirePermission("emailFlow:update", { entity: "EmailFlow", entityId: flowId });
  await requireStaff();

  const flow = await prisma.emailFlow.findUnique({ where: { id: flowId } });
  if (!flow) throw new Error("Flow not found");

  if (flow.n8nWorkflowId) {
    await deactivateN8nWorkflow(flow.n8nWorkflowId);
  }

  const updated = await prisma.emailFlow.update({
    where: { id: flowId },
    data: { active: false },
  });

  revalidateFlow(flowId);
  return updated;
}

/**
 * Sends the flow's first email step to the signed-in staff member's own
 * address, with declared variables filled with visible placeholders.
 */
export async function testEmailFlow(flowId: string) {
  await requirePermission("emailFlow:update", { entity: "EmailFlow", entityId: flowId });
  const session = await requireStaff();
  const to = session.user?.email;
  if (!to) throw new Error("Your account has no email address to test with");

  const flow = await prisma.emailFlow.findUnique({ where: { id: flowId } });
  if (!flow) throw new Error("Flow not found");

  const steps = parseSteps(flow.steps);
  const emailStep = steps.find((s) => s.type === "EMAIL");
  if (!emailStep || emailStep.type !== "EMAIL" || !emailStep.templateId) {
    throw new Error("This flow has no email step with a template to test");
  }

  const template = await prisma.emailFlowTemplate.findUnique({
    where: { id: emailStep.templateId },
  });
  if (!template) throw new Error("Template not found");

  const sampleData: Record<string, unknown> = Object.fromEntries(
    template.variables.map((v) => [v, `[${v}]`])
  );
  sampleData.name = session.user?.name ?? "there";
  sampleData.email = to;

  const rendered = renderTemplate(template, sampleData);
  const result = await sendFlowEmail({
    to,
    subject: `[TEST] ${rendered.subject}`,
    html: rendered.html,
    text: rendered.text,
    fromName: emailStep.fromName ?? null,
  });

  if (!result.ok) throw new Error(result.error);
  return { ok: true };
}
