# Feature Specification: Ticketing system and agent team

**Feature Branch**: `claude/ticketing-plan` (implementation branches per phase: `claude/ticketing-phase-N`)
**Created**: 2026-11-07
**Status**: Draft for review (planned, nothing built)
**Input**: Rhyse's draft, "Ticketing system and agent team plan", 7 Nov 2026.

Goal: staff, agents and clients can raise tickets, and an agent team picks up the suitable ones through a webhook-driven workflow. Every run is logged in full, but people see a clean status and a final message by default.

## Scope decisions (settled)

1. No tickets exist today, so nothing to migrate.
2. Maintenance retainer rules are out of scope. No priority or access tiers yet.
3. The CRM is the single source of truth. Websites only post into it.
4. Full logs are always saved. Default view is a clean status plus a final message.

## User Scenarios & Testing

### User Story 1 - Staff raise and manage tickets in the CRM (Priority: P1)
Rhyse or a staff member creates a ticket on a client record, changes its status, replies, and sees a clean summary with a collapsed full activity log.

**Why this priority**: It is the foundation and the only route needed to test agents.
**Independent Test**: Create a ticket on a client, move it through statuses, and see the clean view and a complete log.
**Acceptance Scenarios**:
1. **Given** a client record, **When** staff create a ticket, **Then** it gets a TKT-0001-style reference, status NEW, and a `ticket.created` event in the log.
2. **Given** a ticket, **When** staff request a disallowed status change, **Then** the API refuses it and logs nothing misleading.
3. **Given** a ticket, **When** a status moves to AWAITING_REVIEW or RESOLVED without `{status, summary, final_message}`, **Then** it goes to NEEDS_HUMAN instead.

### User Story 2 - Agent triages new tickets automatically (Priority: P2)
A signed webhook reaches n8n, a read-only triage agent sets type, priority, agent-eligibility, an acknowledgement and a first status, and posts them back through a scoped key.

**Why this priority**: Lowest-risk agent, proves the webhook and callback loop.
**Independent Test**: Submit a website form and see a triaged, acknowledged ticket with no manual steps.
**Acceptance Scenarios**:
1. **Given** a new ticket, **When** the webhook fires, **Then** n8n verifies the signature, drops anything that fails, and routes by type.
2. **Given** a delivery failure, **When** retries run, **Then** each attempt is logged and the event is idempotent.

### User Story 3 - Clients raise tickets from their website (Priority: P2)
A "Report a problem" form in `site-template` posts to the CRM with a per-site scoped key, honeypot, rate limit and bot check.

**Independent Test**: A real client site form creates a ticket linked to the right client and site.
**Acceptance Scenarios**:
1. **Given** a bot fills the honeypot, **When** the form posts, **Then** no ticket is created.
2. **Given** more posts than the limit, **When** the next arrives, **Then** it is rejected with 429.

### User Story 4 - Software agent opens PRs for small changes (Priority: P3)
For eligible tickets, a routine works on a branch in one client repo, runs checks, opens a PR with a preview link and emits the structured result. It never merges or deploys.

**Independent Test**: Five consecutive small tickets give mergeable PRs, correct clean summaries, no cross-repo access and no secrets in the log.

### User Story 5 - Clients track tickets in the portal (Priority: P3)
Via the existing magic-link login, a client lists tickets, sees the clean view, replies, and receives the final message. Email-in and Uptime Kuma alerts also create tickets.

**Independent Test**: A client raises, tracks and gets a final message entirely in the portal.

### User Story 6 - Content, ops and reply agents (Priority: P4)
Each behind the same draft-only rule, reviewed monthly for success rate, rework and cost.

### Edge Cases
- Ticket text contains instructions aimed at the agent: ignored, flagged as a NEEDS_HUMAN event.
- Client pastes a password or key: redacted before it reaches the log; clients are told not to.
- Agent run cap (2 per ticket) or daily spend cap hit: run blocked, Slack alert.
- Duplicate webhook delivery: idempotency key makes it harmless.
- Agent fails to emit the completion object: ticket goes to NEEDS_HUMAN, never closes.

## Requirements

### Functional Requirements
- **FR-001**: Tickets have clean-view fields: client-friendly status label, one-line `statusSummary`, and `finalMessage`.
- **FR-002**: The activity log (`TicketEvent`) is append-only and records status changes, agent steps, tool calls, webhook deliveries, errors, PR and preview links.
- **FR-003**: Only the CRM API changes ticket status, validating transitions from a fixed table.
- **FR-004**: Internal statuses NEW, TRIAGED, IN_PROGRESS, AWAITING_REVIEW, AWAITING_CLIENT, NEEDS_HUMAN, RESOLVED, CLOSED map to client labels (Received, Being looked at, Working on it, Awaiting your reply, Done; NEEDS_HUMAN shows as "Being looked at").
- **FR-005**: Ticket types SITE_CHANGE, BUG, CONTENT, HOSTING_UPTIME, SEO_ADS_REPORTING, BILLING_ADMIN, INTERNAL, OTHER; only the first three or four are agent-eligible at first.
- **FR-006**: One API (`POST /api/tickets`) serves every intake route; agents call back via `/events`, `/messages`, `/status` with a ticket-only scoped key.
- **FR-007**: CRM emits signed (HMAC-SHA256), idempotent, retried `ticket.created`, `ticket.message_added`, `ticket.status_changed`, `ticket.assigned` events.
- **FR-008**: Secrets are redacted before any event write.
- **FR-013**: `Ticket.shareTechnicalDetails` (default false) controls whether a client can see the activity log; only staff can change it.
- **FR-014**: Raw agent output is purged 12 months after the run; summaries, final messages and events metadata remain.
- **FR-009**: Messages carry PUBLIC or INTERNAL visibility; clients only ever see PUBLIC messages and the clean view.
- **FR-010**: Slack `#tickets` mirrors new tickets and status changes (channel topic checked before posting).
- **FR-011**: Run caps per ticket and per day, with Slack alerts.
- **FR-012**: Attachments are a later phase and out of scope.

### Key Entities
- **Ticket**: reference, client, optional site, requester, source, type, priority, status, title, description, assignee, statusSummary, finalMessage, timestamps.
- **TicketMessage**: ticket, author type, body, visibility.
- **TicketEvent**: ticket, run, seq, kind, actor, JSON payload; append-only.
- **AgentRun**: ticket, agent, start/finish, outcome, PR and preview URLs, cost estimate, raw log reference.
- **WebhookDelivery** (Phase 2): event, endpoint, attempts, next retry, status.

## Success Criteria
- **SC-001**: Phase 1 exit test passes with no manual database edits.
- **SC-002**: A website form submission becomes a triaged, acknowledged ticket with zero manual steps.
- **SC-003**: Five consecutive small tickets produce mergeable PRs with correct clean summaries and no secrets in logs.
- **SC-004**: A client completes raise, track and final message entirely in the portal.
- **SC-005**: No agent can read or write outside its one ticket, one repo, one branch.

## Clarifications

### Session 2026-11-07
- Q: Who sees the full activity log? → A: Staff only, plus a per-ticket share switch.
- Q: Raw agent output retention? → A: 12 months, then purged; delete on client request.
- Q: Ticket reference format? → A: Global TKT-0001 sequence.
- Q: Webhook retry driver? → A: Vercel cron.

## Open decisions (recommended default in brackets)

Decisions 1, 4, 5 and 9 are closed. The rest do not block Phase 1.

1. ~~Who can see the full log?~~ **Decided 2026-11-07**: staff only, with a per-ticket "share technical details" switch.
2. [NEEDS CLARIFICATION] Raw log storage. [Postgres with a size cap now; Cloudflare R2 pointer in `rawLogRef` when output grows.]
3. [NEEDS CLARIFICATION] Triage model and runner. [Haiku via a direct Claude API call in n8n; routines only for software work.]
4. ~~Retention~~ **Decided 2026-11-07**: summaries and final messages kept for the client relationship; raw agent output purged at 12 months; delete on request.
5. ~~Reference format~~ **Decided 2026-11-07**: one global TKT-0001 sequence.
6. [NEEDS CLARIFICATION] Build or buy: confirm a lightweight helpdesk would not cover intake and Slack alone. [Build, because of the link to client, site, repo and agents.]
7. [NEEDS CLARIFICATION] First repo for the software agent. [A low-risk internal or template-based site.]
8. [NEEDS CLARIFICATION] Plan home. [Copy to `ops/plans/PLAN-TICKETING.md` once agreed.]
9. ~~Webhook retry scheduler~~ **Decided 2026-11-07**: Vercel cron (n8n-driven retries only if the plan can't run per-minute cron).

## Assumptions
- Slack is the default alert channel; the connector and token are provisioned separately.
- n8n on the droplet is reachable from Vercel and can reach the Claude API.
- Tickets hold personal data; the privacy policy and data processing clause are updated before client go-live.
