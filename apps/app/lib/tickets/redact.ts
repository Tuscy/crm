/**
 * Strip secrets before anything is written to TicketEvent (constitution V).
 * Conservative on purpose: better to over-redact a log line than leak a key.
 */
export const REDACTED = "[redacted]";

const PATTERNS: { re: RegExp; replace: string }[] = [
  // Authorization headers / bearer tokens
  { re: /\b(Bearer)\s+[A-Za-z0-9._~+/=-]{8,}/gi, replace: `$1 ${REDACTED}` },
  // StickySites and Stripe-style keys
  { re: /\bsk_(live|test)_[A-Za-z0-9]{8,}/g, replace: REDACTED },
  // GitHub, Slack, AWS, Google style tokens
  { re: /\b(ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{16,}/g, replace: REDACTED },
  { re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, replace: REDACTED },
  { re: /\bAKIA[0-9A-Z]{16}\b/g, replace: REDACTED },
  { re: /\bAIza[0-9A-Za-z_-]{30,}/g, replace: REDACTED },
  // password=..., api_key: "...", secret=..., token=...
  {
    re: /\b(pass(?:word|wd)?|secret|api[_-]?key|token|auth)(["']?\s*[:=]\s*["']?)[^\s"',;&]{3,}/gi,
    replace: `$1$2${REDACTED}`,
  },
  // Long hex or base64-ish blobs (32+ chars)
  { re: /\b[A-Fa-f0-9]{32,}\b/g, replace: REDACTED },
  { re: /\b[A-Za-z0-9+/_-]{40,}={0,2}(?=\b|$)/g, replace: REDACTED },
];

const SECRET_KEY_NAMES = /pass(word|wd)?|secret|token|api[_-]?key|authorization|cookie/i;

export function redactString(input: string): string {
  let out = input;
  for (const { re, replace } of PATTERNS) out = out.replace(re, replace);
  return out;
}

/** Deep-redact any JSON-like value. Keys that look secret have their whole value replaced. */
export function redactValue<T>(value: T): T {
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(walk);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_NAMES.test(k) && v != null ? REDACTED : walk(v);
    }
    return out;
  }
  return value;
}
