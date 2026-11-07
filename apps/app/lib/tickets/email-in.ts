/** Pure helpers for the inbound email route. */

export function extractReference(subject: string): string | null {
  const m = /\bTKT-(\d{1,8})\b/i.exec(subject);
  return m ? `TKT-${m[1].padStart(4, "0")}` : null;
}

/** Drops quoted replies and signatures-by-convention so the thread stays readable. */
export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .+ wrote:\s*$/i.test(line.trim())) break;
    if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(line.trim())) break;
    if (/^From:\s.+/i.test(line) && out.length > 0 && out[out.length - 1].trim() === "") break;
    if (line.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

export function normaliseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 320 ? v : null;
}
