"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma, Prisma } from "@stky/db";
import { logActivity } from "@/lib/server/activity-log";
import { enrolMatchingFlows } from "@/lib/email-flows/trigger";
import { requirePermission } from "@/lib/server/guard";

const BILLING_PERIODS = ["monthly", "annual", "quarterly", "one-time"] as const;

export type PackageType = "VOLTAGE" | "CHARGE" | "GRID";
export type ServiceType = "BRANDING" | "WEB" | "ADS";

export type CreateClientInput = {
  name: string;
  companyName?: string;
  companiesHouseNumber?: string;
  industry?: string;
  serviceNotes?: string;
  primaryContactEmail: string;
  contactPhone?: string;
  contactAddress?: string;
  billingPeriod?: string;
  billingPrice?: string | number;
  billingCurrency?: string;
  billingNotes?: string;
  package?: PackageType | null;
  services?: ServiceType[];
};

export type UpdateClientInput = Partial<CreateClientInput>;

function validateCreateInput(data: CreateClientInput) {
  const name = data.name?.trim();
  if (!name) {
    throw new Error("Name is required");
  }

  const email = data.primaryContactEmail?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("A valid primary contact email is required");
  }

  const billingPeriod = data.billingPeriod?.trim();
  if (billingPeriod && !BILLING_PERIODS.includes(billingPeriod as (typeof BILLING_PERIODS)[number])) {
    throw new Error("Invalid billing period");
  }

  let billingPrice: Prisma.Decimal | null = null;
  if (data.billingPrice !== undefined && data.billingPrice !== null && data.billingPrice !== "") {
    const raw = String(data.billingPrice).trim();
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) {
      throw new Error("Billing price must be a valid non-negative number");
    }
    billingPrice = new Prisma.Decimal(raw);
  }

  const companiesHouseNumber = data.companiesHouseNumber?.trim() || null;

  return {
    name,
    companyName: data.companyName?.trim() || null,
    companiesHouseNumber,
    industry: data.industry?.trim() || null,
    serviceNotes: data.serviceNotes?.trim() || null,
    primaryContactEmail: email,
    contactPhone: data.contactPhone?.trim() || null,
    contactAddress: data.contactAddress?.trim() || null,
    billingPeriod: billingPeriod || null,
    billingPrice,
    billingCurrency: data.billingCurrency?.trim() || "GBP",
    billingNotes: data.billingNotes?.trim() || null,
  };
}

async function requireStaffActorId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id || !session.user.isStaff) {
    throw new Error("Staff session required");
  }
  return session.user.id;
}

export async function getClients() {
  return prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { leads: true, memberships: true, analytics: true } },
    },
  });
}

export async function getClientById(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      leads: true,
      memberships: { include: { user: true } },
      googleAdsConnections: true,
      analyticsCredentials: true,
      services: { where: { active: true }, orderBy: { startedAt: "asc" } },
      activityLogs: {
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      siteBuilds: {
        include: { createdBy: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function createClient(data: CreateClientInput) {
  await requirePermission("client:create", { entity: "Client" });
  const validated = validateCreateInput(data);
  const services = data.services ?? [];
  const packageType = data.package ?? null;

  const client = await prisma.client.create({
    data: {
      ...validated,
      package: packageType,
      ...(services.length > 0
        ? { services: { create: services.map((type) => ({ type })) } }
        : {}),
    },
  });

  const actorId = await requireStaffActorId();
  const serviceLabel =
    services.length > 0 ? ` Services: ${services.join(", ")}.` : "";
  const packageLabel = packageType ? ` Package: ${packageType}.` : "";
  await logActivity({
    clientId: client.id,
    type: "client_created",
    body: `Client record created.${packageLabel}${serviceLabel}`,
    actorId,
  });

  await enrolMatchingFlows("CLIENT_CREATED", { clientId: client.id });

  revalidatePath("/dashboard/clients");
  return client;
}

export async function syncClientServices(
  clientId: string,
  types: ServiceType[]
) {
  await requirePermission("client:update", { entity: "Client" });
  const existing = await prisma.clientService.findMany({ where: { clientId } });
  const nextSet = new Set(types);

  for (const row of existing) {
    const shouldBeActive = nextSet.has(row.type);
    if (row.active !== shouldBeActive) {
      await prisma.clientService.update({
        where: { id: row.id },
        data: { active: shouldBeActive },
      });
    }
  }

  for (const type of types) {
    if (!existing.some((r) => r.type === type)) {
      await prisma.clientService.create({ data: { clientId, type } });
    }
  }
}

export async function updateClientPackageAndServices(
  clientId: string,
  data: { package: PackageType | null; services: ServiceType[] }
) {
  await requirePermission("client:update", { entity: "Client" });
  const existing = await prisma.client.findUnique({
    where: { id: clientId },
    include: { services: { where: { active: true } } },
  });
  if (!existing) throw new Error("Client not found");

  await prisma.client.update({
    where: { id: clientId },
    data: { package: data.package },
  });
  await syncClientServices(clientId, data.services);

  const actorId = await requireStaffActorId();
  const prevServices = existing.services.map((s) => s.type).sort().join(", ");
  const nextServices = [...data.services].sort().join(", ");
  const parts: string[] = [];
  if (existing.package !== data.package) {
    parts.push(
      `Package: ${existing.package ?? "none"} → ${data.package ?? "none"}`
    );
  }
  if (prevServices !== nextServices) {
    parts.push(`Services: ${prevServices || "none"} → ${nextServices || "none"}`);
  }
  if (parts.length > 0) {
    await logActivity({
      clientId,
      type: "status_change",
      body: parts.join(". "),
      actorId,
    });
  }

  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function updateClient(id: string, data: UpdateClientInput) {
  await requirePermission("client:update", { entity: "Client", entityId: id });
  const client = await prisma.client.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.companyName !== undefined && {
        companyName: data.companyName.trim() || null,
      }),
      ...(data.companiesHouseNumber !== undefined && {
        companiesHouseNumber: data.companiesHouseNumber.trim() || null,
      }),
      ...(data.industry !== undefined && { industry: data.industry.trim() || null }),
      ...(data.serviceNotes !== undefined && { serviceNotes: data.serviceNotes.trim() || null }),
      ...(data.primaryContactEmail !== undefined && {
        primaryContactEmail: data.primaryContactEmail.trim().toLowerCase(),
      }),
      ...(data.contactPhone !== undefined && {
        contactPhone: data.contactPhone.trim() || null,
      }),
      ...(data.contactAddress !== undefined && {
        contactAddress: data.contactAddress.trim() || null,
      }),
      ...(data.billingPeriod !== undefined && {
        billingPeriod: data.billingPeriod.trim() || null,
      }),
      ...(data.billingCurrency !== undefined && {
        billingCurrency: data.billingCurrency.trim() || null,
      }),
      ...(data.billingNotes !== undefined && {
        billingNotes: data.billingNotes.trim() || null,
      }),
      ...(data.billingPrice !== undefined && {
        billingPrice:
          data.billingPrice === "" || data.billingPrice === null
            ? null
            : new Prisma.Decimal(String(data.billingPrice)),
      }),
    },
  });
  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${id}`);
  return client;
}
