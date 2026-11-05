"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@stky/db";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/server/guard";

async function requireStaff() {
  const session = await auth();
  if (!session?.user?.isStaff) {
    throw new Error("Staff session required");
  }
  return session;
}

export async function getFlowWithEnrollments(flowId: string) {
  await requireStaff();
  return prisma.emailFlow.findUnique({
    where: { id: flowId },
    include: {
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        include: {
          sends: { orderBy: { stepIndex: "asc" } },
        },
      },
    },
  });
}

/**
 * Cancels an enrollment. The CRM stops sending immediately because the
 * step-complete callback ignores any enrollment whose status is not ACTIVE —
 * so downstream emails are suppressed even if the n8n execution keeps walking.
 * We do not deactivate the n8n workflow itself: that would affect every other
 * contact still moving through the same flow.
 */
export async function cancelEnrollment(enrollmentId: string) {
  await requirePermission("emailFlow:update", { entity: "EmailFlowEnrollment", entityId: enrollmentId });
  await requireStaff();

  const enrollment = await prisma.emailFlowEnrollment.findUnique({
    where: { id: enrollmentId },
  });
  if (!enrollment) throw new Error("Enrollment not found");
  if (enrollment.status !== "ACTIVE") {
    return enrollment; // already terminal — nothing to do
  }

  const updated = await prisma.emailFlowEnrollment.update({
    where: { id: enrollmentId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  revalidatePath(`/dashboard/email-flows/${enrollment.flowId}/enrollments`);
  return updated;
}
