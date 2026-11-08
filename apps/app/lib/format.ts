/**
 * Format a date in UK format (DD/MM/YYYY)
 */
export function formatDateUK(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format a date in UK format with month name (e.g. "8 November 2026")
 */
export function formatDateUKLong(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Format currency respecting client/package settings
 * Defaults to GBP (£) for UK business
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = "GBP"
): string {
  if (amount === null || amount === undefined) return "";
  
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "";

  const currencySymbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
  
  return `${currencySymbol}${num.toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
