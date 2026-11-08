"use server";

import { prisma } from "@stky/db";
import { auth } from "@/auth";

export type TodayTask = {
  id: string;
  title: string;
  dueDate: Date | null;
  completed: boolean;
  leadId: string | null;
  lead: { id: string; name: string } | null;
  assignee: { id: string; name: string | null; email: string } | null;
};

export type DealNeedingAction = {
  id: string;
  value: number | null;
  stage: string;
  leadId: string;
  lead: {
    id: string;
    name: string;
    company: string | null;
    nextAction: string | null;
  };
};

export type TodayItems = {
  overdueTasks: TodayTask[];
  dueTodayTasks: TodayTask[];
  upcomingTasks: TodayTask[];
  dealsNeedingAction: DealNeedingAction[];
};

export async function getTodayItems(): Promise<TodayItems> {
  const session = await auth();
  const userId = session?.user?.id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Query tasks (optionally filtered by current user if not staff admin)
  const taskWhere = userId
    ? {
        OR: [{ assigneeId: userId }, { assigneeId: null }],
      }
    : {};

  const [overdueTasks, dueTodayTasks, upcomingTasks, dealsNeedingAction] =
    await Promise.all([
      // Overdue tasks
      prisma.task.findMany({
        where: {
          ...taskWhere,
          completed: false,
          dueDate: {
            lt: today,
          },
        },
        include: {
          lead: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 50,
      }),

      // Due today
      prisma.task.findMany({
        where: {
          ...taskWhere,
          completed: false,
          dueDate: {
            gte: today,
            lt: tomorrow,
          },
        },
        include: {
          lead: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 50,
      }),

      // Upcoming this week
      prisma.task.findMany({
        where: {
          ...taskWhere,
          completed: false,
          dueDate: {
            gte: tomorrow,
            lt: nextWeek,
          },
        },
        include: {
          lead: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 50,
      }),

      // Deals in active stages without next action
      prisma.deal.findMany({
        where: {
          stage: {
            notIn: ["WON", "LOST"],
          },
          lead: {
            OR: [{ nextAction: null }, { nextAction: "" }],
          },
        },
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              company: true,
              nextAction: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

  return {
    overdueTasks: overdueTasks as TodayTask[],
    dueTodayTasks: dueTodayTasks as TodayTask[],
    upcomingTasks: upcomingTasks as TodayTask[],
    dealsNeedingAction: dealsNeedingAction as DealNeedingAction[],
  };
}
