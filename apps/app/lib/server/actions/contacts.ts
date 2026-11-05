"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@stky/db";
import { requirePermission } from "@/lib/server/guard";

export type ContactInput = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  company?: string;
  knownFrom?: string;
  birthday?: Date;
};

export type ContactRow = {
  id: string;
  kind: "contact" | "lead" | "client";
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  knownFrom: string | null;
  birthday: Date | null;
  href: string | null;
};

export async function createContact(data: ContactInput) {
  await requirePermission("contact:create", { entity: "Contact" });
  const contact = await prisma.contact.create({
    data: {
      name: data.name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      company: data.company || undefined,
      knownFrom: data.knownFrom || undefined,
      birthday: data.birthday,
    },
  });
  revalidatePath("/dashboard/contacts");
  return contact;
}

export async function updateContact(id: string, data: ContactInput) {
  await requirePermission("contact:update", { entity: "Contact", entityId: id });
  const contact = await prisma.contact.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      company: data.company || null,
      knownFrom: data.knownFrom || null,
      birthday: data.birthday || null,
    },
  });
  revalidatePath("/dashboard/contacts");
  return contact;
}

export async function deleteContact(id: string) {
  await requirePermission("contact:delete", { entity: "Contact", entityId: id });
  const contact = await prisma.contact.delete({ where: { id } });
  revalidatePath("/dashboard/contacts");
  return contact;
}

export async function getAllContactRows(): Promise<ContactRow[]> {
  const [contacts, leads, clients] = await Promise.all([
    prisma.contact.findMany(),
    prisma.lead.findMany({
      select: { id: true, name: true, email: true, phone: true, company: true },
    }),
    prisma.client.findMany({
      select: {
        id: true,
        name: true,
        primaryContactEmail: true,
        contactPhone: true,
        contactAddress: true,
        companyName: true,
      },
    }),
  ]);

  const rows: ContactRow[] = [
    ...contacts.map((c) => ({
      id: c.id,
      kind: "contact" as const,
      name: c.name,
      email: c.email,
      phone: c.phone,
      company: c.company,
      address: c.address,
      knownFrom: c.knownFrom,
      birthday: c.birthday,
      href: null,
    })),
    ...leads.map((l) => ({
      id: l.id,
      kind: "lead" as const,
      name: l.name,
      email: l.email,
      phone: l.phone,
      company: l.company,
      address: null,
      knownFrom: null,
      birthday: null,
      href: `/dashboard/leads/${l.id}`,
    })),
    ...clients.map((c) => ({
      id: c.id,
      kind: "client" as const,
      name: c.name,
      email: c.primaryContactEmail,
      phone: c.contactPhone,
      company: c.companyName,
      address: c.contactAddress,
      knownFrom: null,
      birthday: null,
      href: `/dashboard/clients/${c.id}`,
    })),
  ];

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}
