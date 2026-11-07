# Plan: Ticketing system and agent team

Adds tickets to the CRM (`packages/db`, `apps/app`) with a clean status and final-message view over an append-only activity log, a scoped-key API, signed webhooks to n8n, and an agent team that only produces drafts and PRs. Based on Rhyse's draft of 7 Nov 2026. Verified against the live codebase 2026-11-07. Nothing is built.

The full plan is written as a Spec Kit feature in [`specs/001-ticketing-and-agent-team/`](../../specs/001-ticketing-and-agent-team/): `spec.md` (what and why), `plan.md` (how), `tasks.md` (ordered tasks with checkpoints), `contracts/` (API and webhook drafts). Principles are in `.specify/memory/constitution.md`.

## Constraints (must hold)

- **New branch, never `main` directly.** Planning branch: `claude/ticketing-plan`. Build phases on `claude/ticketing-phase-N`. Open a PR at the end of each, don't merge it.
- **Migration before deploy.** Every schema change is a real migration applied to production before the code deploys. Never seed production.
- **Draft, don't ship.** Agents produce PRs and drafts. Merging, publishing and customer sends stay human.
- **One phase at a time.** Each has an exit test; the next doesn't start until it passes.
- **One commit per coherent group**, as in the other plans here.

## Phases

1. Foundations (CRM): schema, append-only log, API, staff UI, Slack mirror.
2. Triage and clean view: signed webhooks with retry, n8n triage agent, site form.
3. Software agent: routine opens PRs for small changes (spike first).
4. Client portal and more intake: portal tickets, email-in, Uptime Kuma.
5. Other agents: content/SEO, ops, reply.

## Open decisions

Listed with recommended defaults in `spec.md`. Four block Phase 1: log visibility, retention, reference format, retry scheduler.

## Changelog

| Date | Change |
|---|---|
| 7 Nov 2026 | Implementation plan written as a Spec Kit feature from the first draft. |
