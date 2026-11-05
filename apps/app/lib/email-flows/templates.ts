"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@stky/db";
import { auth } from "@/auth";
import { detectVariables } from "./template-utils";
import { collectTemplateIds, parseSteps } from "./types";
import { requirePermission } from "@/lib/server/guard";

async function requireStaff() {
  const session = await auth();
  if (!session?.user?.isStaff) {
    throw new Error("Staff session required");
  }
  return session;
}

export type SaveTemplateInput = {
  name: string;
  subject: string;
  htmlBody: string;
  textBody?: string | null;
};

export async function getEmailTemplates() {
  await requireStaff();
  return prisma.emailFlowTemplate.findMany({
    orderBy: { updatedAt: "desc" },
  });
}

export async function getEmailTemplateById(id: string) {
  await requireStaff();
  return prisma.emailFlowTemplate.findUnique({ where: { id } });
}

export async function createEmailTemplate(input: SaveTemplateInput) {
  await requirePermission("emailTemplate:create", { entity: "EmailFlowTemplate" });
  await requireStaff();
  const name = input.name?.trim();
  const subject = input.subject?.trim();
  if (!name) throw new Error("Template name is required");
  if (!subject) throw new Error("Subject is required");

  const variables = detectVariables(input.htmlBody, subject, input.textBody ?? "");

  const template = await prisma.emailFlowTemplate.create({
    data: {
      name,
      subject,
      htmlBody: input.htmlBody ?? "",
      textBody: input.textBody?.trim() || null,
      variables,
    },
  });

  revalidatePath("/dashboard/email-flows/templates");
  return template;
}

export async function updateEmailTemplate(id: string, input: SaveTemplateInput) {
  await requirePermission("emailTemplate:update", { entity: "EmailFlowTemplate", entityId: id });
  await requireStaff();
  const name = input.name?.trim();
  const subject = input.subject?.trim();
  if (!name) throw new Error("Template name is required");
  if (!subject) throw new Error("Subject is required");

  const variables = detectVariables(input.htmlBody, subject, input.textBody ?? "");

  const template = await prisma.emailFlowTemplate.update({
    where: { id },
    data: {
      name,
      subject,
      htmlBody: input.htmlBody ?? "",
      textBody: input.textBody?.trim() || null,
      variables,
    },
  });

  revalidatePath("/dashboard/email-flows/templates");
  revalidatePath(`/dashboard/email-flows/templates/${id}`);
  return template;
}

/**
 * Deletes a template — but refuses if it is referenced by any ACTIVE flow's
 * steps JSON. Returns the names of blocking flows so the UI can explain.
 */
export async function deleteEmailTemplate(id: string) {
  await requirePermission("emailTemplate:delete", { entity: "EmailFlowTemplate", entityId: id });
  await requireStaff();

  const activeFlows = await prisma.emailFlow.findMany({
    where: { active: true },
    select: { id: true, name: true, steps: true },
  });

  const blocking = activeFlows.filter((flow) =>
    collectTemplateIds(parseSteps(flow.steps)).includes(id)
  );

  if (blocking.length > 0) {
    throw new Error(
      `Template is used by active flow${blocking.length > 1 ? "s" : ""}: ${blocking
        .map((f) => f.name)
        .join(", ")}. Pause or edit those flows before deleting.`
    );
  }

  await prisma.emailFlowTemplate.delete({ where: { id } });
  revalidatePath("/dashboard/email-flows/templates");
}
