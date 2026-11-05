"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@stky/db";
import { defaultContentForType, sectionTypeKeys, type SectionTypeKey } from "@stky/sites";
import { requirePermission } from "@/lib/server/guard";

export async function listSites() {
  return prisma.site.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      client: true,
      _count: { select: { pages: true } },
    },
  });
}

export async function createSite(formData: FormData) {
  await requirePermission("site:create", { entity: "Site" });
  const clientId = formData.get("clientId") as string;
  const slug = ((formData.get("slug") as string) || "").trim() || null;
  const subdomain = ((formData.get("subdomain") as string) || "").trim() || null;
  const customDomain = ((formData.get("customDomain") as string) || "").trim() || null;

  if (!clientId) {
    throw new Error("Client is required");
  }

  await prisma.site.create({
    data: {
      clientId,
      slug,
      subdomain,
      customDomain,
    },
  });
  revalidatePath("/dashboard/sites");
}

export async function listPagesForSite(siteId: string) {
  return prisma.page.findMany({
    where: { siteId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { sections: true } } },
  });
}

export async function createPage(siteId: string, formData: FormData) {
  await requirePermission("site:create", { entity: "Page", entityId: siteId });
  const raw = ((formData.get("slug") as string) ?? "").trim();
  const slug = raw === "" ? "" : raw.replace(/^\/+/, "").replace(/\/+$/, "");

  const page = await prisma.page.create({
    data: {
      siteId,
      slug,
      published: false,
    },
  });
  revalidatePath(`/dashboard/sites/${siteId}/pages`);
  return page;
}

export async function getPageEditorBundle(pageId: string) {
  return prisma.page.findUnique({
    where: { id: pageId },
    include: {
      sections: { orderBy: { order: "asc" } },
      site: { include: { client: true } },
    },
  });
}

export async function togglePagePublished(pageId: string, published: boolean) {
  await requirePermission("site:update", { entity: "Page", entityId: pageId });
  const page = await prisma.page.update({
    where: { id: pageId },
    data: { published },
    select: { siteId: true },
  });
  revalidatePath(`/dashboard/sites/${page.siteId}/pages`);
  revalidatePath(`/dashboard/sites/${page.siteId}/pages/${pageId}/edit`);
}

export async function updateSectionJson(sectionId: string, rawJson: string) {
  await requirePermission("site:update", { entity: "Section", entityId: sectionId });
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("Invalid JSON");
  }
  const section = await prisma.section.update({
    where: { id: sectionId },
    data: { content: parsed as Prisma.InputJsonValue },
    select: { pageId: true, page: { select: { siteId: true } } },
  });
  revalidatePath(`/dashboard/sites/${section.page.siteId}/pages/${section.pageId}/edit`);
}

export async function createSectionAction(pageId: string, type: string) {
  await requirePermission("site:create", { entity: "Section", entityId: pageId });
  const t = type.toLowerCase() as SectionTypeKey;
  if (!sectionTypeKeys.includes(t)) {
    throw new Error("Invalid section type");
  }
  const maxOrder = await prisma.section.aggregate({
    where: { pageId },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;
  const content = defaultContentForType(t);
  const section = await prisma.section.create({
    data: {
      pageId,
      type: t,
      order,
      content: content as Prisma.InputJsonValue,
    },
    select: { page: { select: { siteId: true } } },
  });
  revalidatePath(`/dashboard/sites/${section.page.siteId}/pages/${pageId}/edit`);
}

export async function deleteSectionAction(sectionId: string) {
  await requirePermission("site:delete", { entity: "Section", entityId: sectionId });
  const section = await prisma.section.delete({
    where: { id: sectionId },
    select: { pageId: true, page: { select: { siteId: true } } },
  });
  revalidatePath(`/dashboard/sites/${section.page.siteId}/pages/${section.pageId}/edit`);
}

export async function saveSectionFromForm(formData: FormData) {
  const id = formData.get("sectionId") as string;
  const raw = formData.get("json") as string;
  await updateSectionJson(id, raw);
}

export async function deleteSectionFromForm(formData: FormData) {
  const id = formData.get("sectionId") as string;
  await deleteSectionAction(id);
}

export async function addSectionFromForm(formData: FormData) {
  const pageId = formData.get("pageId") as string;
  const type = formData.get("type") as string;
  await createSectionAction(pageId, type);
}

export async function reorderSectionsAction(pageId: string, orderedIds: string[]) {
  await requirePermission("site:update", { entity: "Page", entityId: pageId });
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { siteId: true },
  });
  if (!page) throw new Error("Page not found");

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.section.update({
        where: { id, pageId },
        data: { order: index },
      })
    )
  );
  revalidatePath(`/dashboard/sites/${page.siteId}/pages/${pageId}/edit`);
}
