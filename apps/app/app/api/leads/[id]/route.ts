import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stky/db";
import { isValidLeadStatus } from "@stky/crm";
import { requireAutomationAuth } from "@/lib/api-auth";
import { ApiScope } from "@/lib/api-scopes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (
    !(await requireAutomationAuth(
      request,
      "GET /api/leads/[id]",
      ApiScope.LEADS_READ
    ))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        deals: true,
        tasks: true,
        notes: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("GET /api/leads/[id]:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (
    !(await requireAutomationAuth(request, "PUT /api/leads/[id]", ApiScope.LEADS_WRITE, "lead:update"))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, company, website, source, status } = body;

    if (status !== undefined && !isValidLeadStatus(status)) {
      return NextResponse.json({ error: "Invalid lead status" }, { status: 400 });
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(company !== undefined && { company }),
        ...(website !== undefined && { website }),
        ...(source !== undefined && { source }),
        ...(status !== undefined && { status }),
      },
      include: { deals: true, tasks: true, notes: true },
    });

    return NextResponse.json(lead);
  } catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    console.error("PUT /api/leads/[id]:", error);
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (
    !(await requireAutomationAuth(request, "DELETE /api/leads/[id]", ApiScope.LEADS_DELETE, "lead:delete"))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await prisma.lead.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    console.error("DELETE /api/leads/[id]:", error);
    return NextResponse.json(
      { error: "Failed to delete lead" },
      { status: 500 }
    );
  }
}
