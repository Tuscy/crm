# Tasks: Ticketing system and agent team

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [contracts/](./contracts/)
**Format**: `[ID] [P?] [Story] Description`. `[P]` means it can run alongside other `[P]` tasks (different files). Paths are relative to the CRM repo root. Each phase ends at a checkpoint; do not start the next phase until it passes. One commit per group.

## Phase 0: Decisions to close before Phase 1
- [x] T001 Open decisions 1, 4, 5 and 9 closed 2026-11-07 (see spec.md Clarifications)
- [ ] T002 Confirm the Vercel plan supports per-minute cron (decision 9 assumes it); otherwise n8n calls the retry route

## Phase 1: Foundations (US1)

### Schema and migration
- [x] T010 [US1] Add models and enums to `packages/db/prisma/schema.prisma`: Ticket (including `shareTechnicalDetails` boolean, default false), TicketMessage, TicketEvent, AgentRun, TicketCounter; enums for status, type, priority, requester/assignee/author type, visibility
- [x] T011 [US1] Write `packages/db/prisma/migrations/<ts>_tickets/migration.sql` including the `TicketEvent` no-update/no-delete trigger
- [ ] T012 [US1] Apply to production with `prisma migrate deploy` BEFORE any code deploy. Tested so far on an in-memory Postgres (PGlite): all 21 migrations apply; UPDATE and direct DELETE on `TicketEvent` are refused; Ticket/Client cascade deletes still work. Still to do: a Neon branch rehearsal and the production apply (Rhyse)
- [x] T013 [P] [US1] `pnpm db:generate` done. `pnpm lint` is not usable: ESLint was never configured in `apps/app` (`next lint` prompts for setup); `next build` and `tsc --noEmit` pass instead. `pnpm build` needs `NODE_OPTIONS=--max-old-space-size=8192` here (default heap ran out)

### Tests and core logic
- [x] T020 [US1] Add Vitest to `apps/app` (`test` script, config) and wire into turbo
- [x] T021 [P] [US1] `apps/app/lib/tickets/transitions.ts` plus tests: allowed-transition table, completion contract
- [x] T022 [P] [US1] `apps/app/lib/tickets/redact.ts` plus tests: tokens, `sk_` keys, password pairs
- [x] T023 [P] [US1] `apps/app/lib/tickets/status-labels.ts`: internal to client label map
- [x] T024 [US1] `apps/app/lib/tickets/reference.ts`: TKT-0001 from `TicketCounter` inside the create transaction
- [x] T025 [US1] `apps/app/lib/tickets/events.ts`: `emitTicketEvent()` (redact, assign `seq`, insert) and `transitionTicket()` as sole status writer

### Permissions and keys
- [x] T030 [P] [US1] Add `ticket` to `BUSINESS_RESOURCES` in `apps/app/lib/permissions.ts`
- [x] T031 [P] [US1] Add `tickets:*` scopes in `apps/app/lib/api-scopes.ts`
- [x] T032 [US1] Add `requireTicketAuth()` in `apps/app/lib/api-auth.ts`: returns key record, no legacy fallback, no empty-scope wildcard, site binding check; tests

### API and UI
- [x] T040 [US1] `apps/app/app/api/tickets/route.ts` and `[id]/route.ts` per contracts/tickets-api.md
- [x] T041 [US1] `apps/app/app/api/tickets/[id]/{events,messages,status}/route.ts`
- [x] T042 [US1] `apps/app/lib/server/actions/tickets.ts` (create, update, reply, change status) using `requirePermission` and `audit()`
- [x] T043 [P] [US1] `apps/app/app/dashboard/tickets/page.tsx` list
- [x] T044 [US1] `apps/app/app/dashboard/tickets/[id]/page.tsx` detail: status, summary, final message, conversation, collapsed activity log, and a staff-only "share technical details" toggle (audited)
- [x] T045 [P] [US1] Add `tickets` tab to `apps/app/app/dashboard/clients/[id]/page.tsx`
- [x] T046 [P] [US1] Nav entry in `apps/app/components/dashboard/dashboard-nav.tsx`
- [x] T047 [US1] Key creation UI supports ticket scopes and site binding (`apps/app/app/dashboard/settings/api-keys/`)

### Slack mirror
- [x] T050 [US1] `apps/app/lib/slack/client.ts` and `ticket-mirror.ts` behind `SLACK_TICKETS_ENABLED`; check channel topic first; document env vars in `.env.example`

**Checkpoint 1** (code complete; production migration and a click-through on a real database are still outstanding): create a ticket in the CRM, change status, see the right clean view and a full log; UPDATE on `TicketEvent` fails; disallowed transitions refused; `pnpm lint` and `pnpm build` pass.

## Phase 2: Triage and clean view (US2, US3)
- [ ] T100 [US2] Migration: `WebhookDelivery` table (applied to prod first)
- [ ] T101 [US2] `apps/app/lib/webhooks/ticket-dispatch.ts` reusing signing from `lib/webhooks/dispatch.ts`; delivery row in the event transaction; tests for signature and idempotency
- [ ] T102 [US2] `apps/app/app/api/cron/webhook-retries/route.ts` and `vercel.json` cron entry; backoff and dead-letter with Slack alert
- [ ] T103 [US2] Delivery attempts written to `TicketEvent`
- [ ] T104 [P] [US2] n8n triage workflow: verify signature, route by type and agent-eligible flag
- [ ] T105 [P] [US2] `automation/agents/triage.md` prompt (read-only, ticket text quoted as data)
- [ ] T106 [US3] Ticket intake endpoint hardening: stricter rate limit (`rateLimitByIdentity` keyed on key id and IP), honeypot, bot check
- [ ] T107 [US3] "Report a problem" component in `StickySites/site-template` with per-site scoped key
- [ ] T108 [US3] Add form to every new site by default and update `ops/sops/SOP-06-WEBSITE-BUILD.md`
- [ ] T109 Privacy policy and data processing clause updated for the ticket system

**Checkpoint 2**: submit from a real client site form and see a triaged ticket with an acknowledgement and no manual steps.

## Phase 3: Software agent (US4)
- [ ] T200 Spike: confirm how n8n fires a Claude Code routine and how it reports back; write findings to `specs/001-ticketing-and-agent-team/research.md`
- [ ] T201 [US4] n8n step creating a GitHub issue in the client repo
- [ ] T202 [US4] `automation/agents/software.md` routine prompt with forbidden areas (schema, DNS, billing, secrets, prod DB) and untrusted-ticket rule
- [ ] T203 [US4] Routine opens PR with preview link and posts `{status, summary, final_message}`; failing checks retry once then NEEDS_HUMAN
- [ ] T204 [US4] Run cap (2 per ticket) and daily spend cap, Slack alert on hit
- [ ] T205 [US4] Pick the first low-risk repo (open decision 7) and run five real small tickets

**Checkpoint 3**: five consecutive small tickets give mergeable PRs and correct clean summaries, no cross-repo access, no secrets in logs.

## Phase 4: Portal and intake (US5)
- [ ] T300 [US5] `apps/app/app/client/tickets/` list, detail (clean view only), reply box
- [ ] T301 [US5] Email-in route and threading of replies
- [ ] T302 [US5] Inbound Uptime Kuma webhook creating HOSTING_UPTIME tickets, with dedupe
- [ ] T304 [US5] Portal shows the activity log only when `shareTechnicalDetails` is true (FR-013); test that it is hidden otherwise
- [ ] T303 [US5] Final message sent to client (staff-sent, AI disclosure or named human)

**Checkpoint 4**: a client raises, tracks and gets a final message entirely in the portal.

## Phase 5: Other agents (US6)
- [ ] T400 Content and SEO agent (drafts only, human review before publishing)
- [ ] T401 Ops agent (diagnose and propose, no infra changes)
- [ ] T402 Reply agent (drafts; staff send)
- [ ] T403 Monthly review: success rate, rework rate, cost per ticket; cut or tighten any agent that creates more work than it saves

## Phase 6: Retention (FR-014)
- [ ] T500 Scheduled, audited purge of raw agent output older than 12 months (storage object and any inline raw text; `TicketEvent` rows and metadata stay); delete-on-request path for a client's tickets; document in the privacy policy

**Checkpoint 6**: a test run older than 12 months has its raw output removed and its events intact.

## Dependencies
Phase 0 → 1 → 2 → 3 → 4 → 5; Phase 6 can run any time after Phase 3 produces raw output. Within a phase, `[P]` tasks run together; schema (T010-T012) blocks everything else in that phase.
