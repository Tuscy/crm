import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stky/db";
import type { Prisma } from "@stky/db";
import { requireAutomationAuth } from "@/lib/api-auth";
import { ApiScope } from "@/lib/api-scopes";

export async function GET(request: NextRequest) {
  if (
    !(await requireAutomationAuth(
      request,
      "GET /api/tasks",
      ApiScope.TASKS_READ
    ))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const completed = searchParams.get("completed");
    const leadId = searchParams.get("leadId");
    const assigneeId = searchParams.get("assigneeId");

    const where: Prisma.TaskWhereInput = {
      ...(completed !== null && { completed: completed === "true" }),
      ...(leadId && { leadId }),
      ...(assigneeId && { assigneeId }),
    };

    const tasks = await prisma.task.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ completed: "asc" }, { dueDate: "asc" }],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("GET /api/tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (
    !(await requireAutomationAuth(request, "POST /api/tasks", ApiScope.TASKS_WRITE, "task:create"))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, leadId, dueDate, assigneeId } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        leadId: leadId ?? undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        assigneeId: assigneeId ?? undefined,
      },
      include: {
        lead: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    if ((error as { code?: string })?.code === "P2003") {
      return NextResponse.json(
        { error: "leadId or assigneeId does not exist" },
        { status: 400 }
      );
    }
    console.error("POST /api/tasks:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
