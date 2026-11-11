"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@stky/db";
import { auth } from "@/auth";
import { enrolMatchingFlows } from "@/lib/email-flows/trigger";
import { requirePermission } from "@/lib/server/guard";

export async function createTask(
  title: string,
  opts?: { leadId?: string; dueDate?: Date; assigneeId?: string; notes?: string }
) {
  await requirePermission("task:create", { entity: "Task" });
  let assigneeId = opts?.assigneeId || null;
  if (!opts?.leadId && !assigneeId) {
    const session = await auth();
    assigneeId = session?.user?.id ?? null;
  }

  const task = await prisma.task.create({
    data: {
      leadId: opts?.leadId || null,
      title,
      dueDate: opts?.dueDate,
      assigneeId,
      notes: opts?.notes?.trim() || null,
    },
  });
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/today");
  if (task.leadId) {
    revalidatePath(`/dashboard/leads/${task.leadId}`);
  }
  return task;
}

export async function toggleTaskCompleted(taskId: string) {
  await requirePermission("task:update", { entity: "Task", entityId: taskId });
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { completed: !task.completed },
  });
  // Fire only on the false → true transition.
  if (updated.leadId && updated.completed && !task.completed) {
    await enrolMatchingFlows("TASK_COMPLETED", { leadId: updated.leadId });
  }
  revalidatePath("/dashboard/tasks");
  if (updated.leadId) {
    revalidatePath(`/dashboard/leads/${updated.leadId}`);
  }
  return updated;
}

export async function deleteTask(taskId: string) {
  await requirePermission("task:delete", { entity: "Task", entityId: taskId });
  const task = await prisma.task.delete({ where: { id: taskId } });
  revalidatePath("/dashboard/tasks");
  if (task.leadId) {
    revalidatePath(`/dashboard/leads/${task.leadId}`);
  }
  return task;
}

export async function getMyTasks() {
  const session = await auth();
  if (!session?.user?.id) return [];
  return prisma.task.findMany({
    where: {
      OR: [{ assigneeId: session.user.id }, { assigneeId: null }],
    },
    include: { lead: { select: { id: true, name: true } } },
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }],
  });
}

export async function getStaffUsers() {
  return prisma.user.findMany({
    where: { isStaff: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}
