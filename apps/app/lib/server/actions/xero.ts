"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@stky/db";
import {
  clearXeroAccessCache,
  deleteXeroConnection,
  getXeroAccess,
  getXeroConnections,
} from "@/lib/xero/oauth";
import {
  XeroNotConnectedError,
  getContacts,
  getInvoicesForContact,
  type XeroContact,
  type XeroInvoice,
} from "@/lib/xero/client";

async function requireStaff() {
  const session = await auth();
  if (!session?.user?.isStaff) throw new Error("Unauthorized");
  return session;
}

export type XeroConnectionStatus =
  | { connected: false }
  | { connected: true; tenantName: string | null; connectedAt: string };

export async function getXeroConnectionStatus(): Promise<XeroConnectionStatus> {
  await requireStaff();
  const cred = await prisma.xeroCredential.findFirst({
    orderBy: { connectedAt: "desc" },
    select: { tenantName: true, connectedAt: true },
  });
  if (!cred) return { connected: false };
  return {
    connected: true,
    tenantName: cred.tenantName,
    connectedAt: cred.connectedAt.toISOString(),
  };
}

/** Live from Xero, for the mapping UI. */
export async function listXeroContacts(): Promise<XeroContact[]> {
  await requireStaff();
  return getContacts();
}

export async function setClientXeroContact(clientId: string, xeroContactId: string | null) {
  await requireStaff();
  await prisma.client.update({
    where: { id: clientId },
    data: { xeroContactId: xeroContactId?.trim() || null },
  });
  revalidatePath("/dashboard/settings/xero");
  revalidatePath(`/dashboard/clients/${clientId}`);
}

export type ClientInvoicesResult =
  | { status: "not_connected" }
  | { status: "not_mapped" }
  | { status: "ok"; invoices: XeroInvoice[] }
  | { status: "error"; error: string };

/** Live fetch via the client's mapped xeroContactId — nothing stored locally. */
export async function getInvoicesForClient(clientId: string): Promise<ClientInvoicesResult> {
  await requireStaff();
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { xeroContactId: true },
  });
  const connected = (await prisma.xeroCredential.count()) > 0;
  if (!connected) return { status: "not_connected" };
  if (!client?.xeroContactId) return { status: "not_mapped" };

  try {
    return { status: "ok", invoices: await getInvoicesForContact(client.xeroContactId) };
  } catch (err) {
    if (err instanceof XeroNotConnectedError) return { status: "not_connected" };
    console.error("Xero invoices fetch failed:", err);
    return { status: "error", error: "Failed to load invoices from Xero" };
  }
}

/** Removes the connection in Xero (best effort) and locally. Mappings are kept. */
export async function disconnectXero() {
  await requireStaff();
  try {
    const access = await getXeroAccess();
    if (access) {
      const conns = await getXeroConnections(access.accessToken);
      const conn = conns.find((c) => c.tenantId === access.tenantId);
      if (conn) await deleteXeroConnection(access.accessToken, conn.id);
    }
  } catch (err) {
    console.error("Xero disconnect (remote) failed:", err);
  }
  await prisma.xeroCredential.deleteMany({});
  clearXeroAccessCache();
  revalidatePath("/dashboard/settings/xero");
}
