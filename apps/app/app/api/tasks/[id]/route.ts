import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stky/db";
import { requireAutomationAuth } from "@/lib/api-auth";
import { ApiScope } from "@/lib/api-scopes";
import { enrolMatchingFlows } from "@/lib/email-flows/trigger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (
    !(await requireAutomationAuth(
      request,
      "GET /api/tasks/[id]",
      ApiScope.TASKS_READ
    ))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("GET /api/tasks/[id]:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (
    !(await requireAutomationAuth(request, "PATCH /api/tasks/[id]", ApiScope.TASKS_WRITE, "task:update"))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, dueDate, completed, assigneeId, leadId } = body;

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(dueDate !== undefined && {
          dueDate: dueDate ? new Date(dueDate) : null,
        }),
        ...(completed !== undefined && { completed }),
        ...(assigneeId !== undefined && { assigneeId }),
        ...(leadId !== undefined && { leadId }),
      },
      include: {
        lead: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    // Fire only on the false → true transition, same as the dashboard toggle.
    if (task.leadId && task.completed && !existing.completed) {
      await enrolMatchingFlows("TASK_COMPLETED", { leadId: task.leadId });
    }

    return NextResponse.json(task);
  } catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if ((error as { code?: string })?.code === "P2003") {
      return NextResponse.json(
        { error: "leadId or assigneeId does not exist" },
        { status: 400 }
      );
    }
    console.error("PATCH /api/tasks/[id]:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (
    !(await requireAutomationAuth(request, "DELETE /api/tasks/[id]", ApiScope.TASKS_DELETE, "task:delete"))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    console.error("DELETE /api/tasks/[id]:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
