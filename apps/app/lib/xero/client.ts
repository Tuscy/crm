import { getXeroAccess } from "./oauth";

/**
 * Thin read-only wrapper over the Xero Accounting API. Every call fetches a
 * valid access token first (refreshing if the 30-minute token has expired).
 */

const API_BASE = "https://api.xero.com/api.xro/2.0";

export class XeroNotConnectedError extends Error {
  constructor() {
    super("Xero is not connected");
  }
}

async function xeroGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const access = await getXeroAccess();
  if (!access) throw new XeroNotConnectedError();

  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${access.accessToken}`,
      "xero-tenant-id": access.tenantId,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Xero API ${path} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ── contacts ─────────────────────────────────────────────────────────────────

export type XeroContact = {
  contactId: string;
  name: string;
  email: string | null;
};

type RawContact = {
  ContactID: string;
  Name: string;
  EmailAddress?: string;
  ContactStatus?: string;
};

const PAGE_SIZE = 100;

/** All active contacts, for the client-to-contact mapping dropdown. */
export async function getContacts(): Promise<XeroContact[]> {
  const out: XeroContact[] = [];
  for (let page = 1; page <= 50; page++) {
    const data = await xeroGet<{ Contacts: RawContact[] }>("/Contacts", {
      page: String(page),
      summaryOnly: "true",
      where: 'ContactStatus=="ACTIVE"',
      order: "Name ASC",
    });
    for (const c of data.Contacts) {
      out.push({ contactId: c.ContactID, name: c.Name, email: c.EmailAddress || null });
    }
    if (data.Contacts.length < PAGE_SIZE) break;
  }
  return out;
}

// ── invoices ─────────────────────────────────────────────────────────────────

export type XeroInvoice = {
  invoiceId: string;
  number: string | null;
  status: string; // DRAFT | SUBMITTED | AUTHORISED | PAID | VOIDED | DELETED
  contactId: string;
  date: string | null; // YYYY-MM-DD
  dueDate: string | null; // YYYY-MM-DD
  total: number;
  amountDue: number;
  currency: string;
  xeroUrl: string; // opens the invoice in Xero (staff login)
};

type RawInvoice = {
  InvoiceID: string;
  InvoiceNumber?: string;
  Type: string;
  Status: string;
  Contact: { ContactID: string };
  DateString?: string;
  DueDateString?: string;
  Total?: number;
  AmountDue?: number;
  CurrencyCode?: string;
};

function toInvoice(r: RawInvoice): XeroInvoice {
  return {
    invoiceId: r.InvoiceID,
    number: r.InvoiceNumber || null,
    status: r.Status,
    contactId: r.Contact.ContactID,
    date: r.DateString?.slice(0, 10) ?? null,
    dueDate: r.DueDateString?.slice(0, 10) ?? null,
    total: r.Total ?? 0,
    amountDue: r.AmountDue ?? 0,
    currency: r.CurrencyCode ?? "GBP",
    xeroUrl: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${r.InvoiceID}`,
  };
}

/** Sales invoices (ACCREC) for one contact, newest first — first 100 only. */
export async function getInvoicesForContact(xeroContactId: string): Promise<XeroInvoice[]> {
  const data = await xeroGet<{ Invoices: RawInvoice[] }>("/Invoices", {
    ContactIDs: xeroContactId,
    where: 'Type=="ACCREC"',
    order: "Date DESC",
    summaryOnly: "true",
    page: "1",
  });
  return data.Invoices.filter((i) => i.Status !== "DELETED").map(toInvoice);
}

/** One invoice by ID — used by the webhook to find the contact and new status. */
export async function getInvoice(invoiceId: string): Promise<XeroInvoice | null> {
  const data = await xeroGet<{ Invoices: RawInvoice[] }>(
    `/Invoices/${encodeURIComponent(invoiceId)}`
  );
  const raw = data.Invoices[0];
  return raw && raw.Type === "ACCREC" ? toInvoice(raw) : null;
}
