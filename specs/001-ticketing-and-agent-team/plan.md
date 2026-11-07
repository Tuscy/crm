# Implementation Plan: Ticketing system and agent team

**Branch**: `claude/ticketing-plan` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

## Summary

Add a ticket system to the Stky CRM (`apps/app`, `packages/db`) with a clean status/final-message view over an append-only log, a scoped-key API, signed webhooks to n8n, and an agent team that only ever produces drafts and PRs. Built in five gated phases.

## Technical Context

**Language/Version**: TypeScript, Next.js 14.2 (App Router), Auth.js v5 beta
**Primary Dependencies**: Prisma (Postgres on Neon), `@stky/ui`, `@stky/security`, Upstash rate limiting, Resend, `@vercel/functions`
**Storage**: Postgres via `packages/db/prisma/schema.prisma`; migrations are hand-readable SQL, deployed with `prisma migrate deploy`
**Testing**: none today. Add Vitest to `apps/app` in Phase 1 (transition table, redaction, HMAC signing). No CI directory exists; exit tests are manual plus `pnpm lint` and `pnpm build`
**Target Platform**: Vercel (app), n8n on a droplet (orchestration), Claude Code cloud routines (software agent)
**Constraints**: migration-before-deploy; never seed production; agents draft, never ship

## Constitution Check

| Principle | How the plan satisfies it |
|---|---|
| II Migration before deploy | Each phase's schema change is its own migration, applied to prod first; documented in the tasks |
| III Draft, don't ship | Agent keys carry no merge, publish, or customer-send capability; reply agent drafts only |
| IV Single writer, append-only | Transition table in `lib/tickets/transitions.ts`; DB trigger rejects UPDATE/DELETE on `TicketEvent` |
| V Untrusted input | Ticket text passed to agents as quoted data; redaction before event write; per-purpose scopes |
| VI Verify | Exit test per phase; Vitest for pure logic |

## Current state (verified against the codebase 2026-11-07)

- **Schema**: cuid ids, camelCase, `createdAt`/`updatedAt`. `Client` and `Site` follow a `clientId` FK with `onDelete: Cascade` and `@@index([clientId])`. Softer states are `String` with a comment; stable sets are real enums. Latest migration `20261105120000_staff_roles_audit_log`. `AuditLog` append-only is convention only.
- **Permissions**: `apps/app/lib/permissions.ts` (`BUSINESS_RESOURCES`, `can`); guards in `apps/app/lib/server/guard.ts` (`requirePermission`, `denyUnlessCan`, `currentStaffCan`); `audit()` in `apps/app/lib/server/audit.ts`.
- **Scoped keys**: `IntegrationApiKey` model; `apps/app/lib/api-auth.ts` `requireAutomationAuth` returns a boolean only and falls back to legacy `CRM_API_KEY`; empty scopes mean everything (`apps/app/lib/api-scopes.ts`). Not safe as-is for per-agent identity.
- **Webhooks**: `apps/app/lib/webhooks/dispatch.ts` signs `X-Stky-Signature: sha256=<hex>` but has one global URL, no retry, no persistence. `apps/app/lib/xero/webhook.ts` shows inbound HMAC verification with `timingSafeEqual`.
- **Rate limit**: `packages/security/src/rate-limit.ts` (`rateLimit`, `rateLimitByIdentity`); middleware at `apps/app/middleware.ts`.
- **Portal**: `apps/app/lib/server/actions/client-auth.ts`, `apps/app/app/client/*`.
- **Uptime Kuma**: pull-only (`apps/app/lib/uptime-kuma/`). No inbound webhook.
- **Greenfield**: Slack, retry scheduler (no cron in `vercel.json`), `automation/agents/`, test runner.

## Project Structure

### Documentation
```text
specs/001-ticketing-and-agent-team/
├── spec.md
├── plan.md
├── tasks.md
└── contracts/
    ├── tickets-api.md
    └── webhook-events.md
docs/plans/ticketing-and-agent-team.md   # index doc pointing here
```

### Source Code
```text
packages/db/prisma/
├── schema.prisma                         # + Ticket, TicketMessage, TicketEvent, AgentRun, TicketCounter, WebhookDelivery
└── migrations/<ts>_tickets/migration.sql # includes append-only trigger on TicketEvent
apps/app/
├── lib/permissions.ts                    # + "ticket" in BUSINESS_RESOURCES
├── lib/api-scopes.ts                     # + tickets:read/write, tickets:agent, tickets:intake
├── lib/api-auth.ts                       # + requireTicketAuth() returning the key record, no legacy fallback
├── lib/tickets/                          # transitions.ts, status-labels.ts, redact.ts, events.ts, reference.ts
├── lib/slack/                            # client.ts, ticket-mirror.ts
├── lib/webhooks/ticket-dispatch.ts       # reuses signing from dispatch.ts
├── lib/server/actions/tickets.ts         # staff server actions
├── app/api/tickets/                      # route.ts, [id]/route.ts, [id]/{events,messages,status}/route.ts
├── app/api/cron/webhook-retries/route.ts # Phase 2
├── app/dashboard/tickets/                # list + [id] detail
├── app/dashboard/clients/[id]/page.tsx   # + "tickets" tab
├── components/dashboard/dashboard-nav.tsx# + Tickets entry
└── app/client/tickets/                   # Phase 4
automation/agents/                        # triage.md, software.md, ... prompts (Phase 2+)
```

**Structure Decision**: extend the existing monorepo patterns (server actions for staff UI, route handlers for external callers, `lib/<domain>/` for logic) rather than a new package.

## Design decisions

1. **Status writer.** `transitionTicket(ticketId, to, actor, payload)` is the only function that updates `Ticket.status`. It checks the transition table, enforces the completion contract for AWAITING_REVIEW/RESOLVED, writes the event and fires webhook and Slack. Route handlers and server actions both call it.
2. **Append-only log.** Migration adds a trigger `ticket_event_no_mutate` raising on UPDATE and DELETE. Retention purge (12 months) runs as a dedicated, audited SQL path that disables nothing: it nulls `rawLogRef` content in storage, not rows.
3. **Key model.** Reuse `IntegrationApiKey`; add `kind` scopes. Agent keys: `tickets:agent` (events, messages, status requests on tickets assigned to that agent). Site-form keys: `tickets:intake`, bound to one `siteId` via key metadata so a key cannot post for another client. `requireTicketAuth` rejects the legacy env key and empty-scope wildcards.
4. **Redaction.** `redactSecrets()` runs over payloads before `TicketEvent` insert: bearer tokens, `sk_` keys, password-like key/value pairs, long hex/base64 strings. Unit tested.
5. **Webhooks.** `WebhookDelivery` rows created in the same transaction as the event; sender attempts immediately via `waitUntil`; Vercel cron every minute retries with backoff (1m, 5m, 30m, 2h, then dead-letter and Slack alert). Idempotency key = delivery id.
6. **Clean view.** `status-labels.ts` maps internal to client labels; the portal and site form only ever read `{label, statusSummary, finalMessage, PUBLIC messages}`.
7. **Reference numbers.** `TicketCounter` single row incremented in the create transaction, formatted `TKT-0001`.
8. **Agent prompts** live in `automation/agents/` and carry the forbidden-areas list and the untrusted-ticket-text rule.

## Phases and exit tests

### Phase 1: Foundations (CRM)
Schema and migration (applied to prod first), Vitest setup, `lib/tickets/*`, ticket API with scoped keys, staff UI (list, detail, client tab, nav), Slack mirror behind a flag.
**Exit test**: create a ticket in the CRM, change status, see the right clean view and a full log; an UPDATE on `TicketEvent` fails; disallowed transitions are refused.

### Phase 2: Triage and the clean view
`WebhookDelivery`, signed events with retries and delivery logging, cron route, n8n triage workflow and prompt, `site-template` form component with rate limit, honeypot and bot check.
**Exit test**: real client site form gives a triaged, acknowledged ticket with no manual steps.

### Phase 3: Software agent
Spike first: how n8n fires a Claude Code routine and how it reports back (written up before building). Then GitHub issue creation, routine prompt, PR plus preview link, structured final output, run and spend caps.
**Exit test**: five consecutive small tickets produce mergeable PRs and correct clean summaries, no cross-repo access, no secrets in the log.

### Phase 4: Client portal and more intake
Portal ticket list, detail and reply; email-in; inbound Uptime Kuma webhook creating HOSTING_UPTIME tickets.
**Exit test**: a client raises, tracks and gets a final message entirely in the portal.

### Phase 5: Other agents
Content/SEO, ops, reply agents in that order, each draft-only. Monthly review of success rate, rework rate and cost per ticket.

## Risks
- **Migration on prod**: a bad trigger blocks log writes. Mitigation: test the migration on a Neon branch first and apply to prod before deploying code.
- **Cron on Vercel plan limits**: confirm the plan allows per-minute cron; otherwise n8n schedules the retry call.
- **Routine trigger unknown**: Phase 3 spike gates all later work.
- **No CI**: lint/build/tests are manual; consider adding a minimal workflow separately.

## Complexity Tracking
No constitution violations.
