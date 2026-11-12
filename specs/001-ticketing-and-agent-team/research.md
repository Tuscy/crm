# Phase 3 spike: how n8n fires a Claude Code routine

Done 2026-11-07 from the Claude Code docs (https://code.claude.com/docs/en/routines).
Findings are from documentation only; **no call has been made against a real routine yet**.

## What the docs say

- A routine (docs now say "scheduled task") can have an **API trigger**: a per-routine
  endpoint plus a bearer token, created at claude.ai/code/routines. The token is shown once
  and can't be retrieved; the CLI cannot create or revoke it.
- Fire it with:
  `POST https://api.anthropic.com/v1/claude_code/routines/<trig_id>/fire`
  with headers `Authorization: Bearer <token>`, `anthropic-beta: experimental-cc-routine-2026-04-01`,
  `anthropic-version: 2023-06-01`, and an optional JSON body `{ "text": "..." }`.
- The response is `{ "type": "routine_fire", "claude_code_session_id": "...", "claude_code_session_url": "..." }`.
  It starts a session and returns immediately; **it does not return the run's result.**
- `text` is freeform and unparsed. It reaches the routine wrapped in a
  `<routine-fire-payload>` block labelled as untrusted data, and the routine's saved prompt
  must explicitly opt in to acting on it.
- The endpoint is in research preview under a dated beta header, so shapes and limits may
  change. It is available to claude.ai accounts only, not the Claude Platform API.
- Limits: API fires are 30 per hour per routine and 100 per hour per account, with no overage.
  Runs also count against the account's usage limits. Runs and PRs appear as the account
  owner's GitHub identity.

## Decisions this leads to

1. **Results come back through the CRM, not the fire response.** The routine calls the
   ticket API itself with a `tickets:agent` key held in the routine's cloud environment
   (`CRM_BASE_URL`, `CRM_AGENT_KEY`). The key is never put in fire text.
2. **Fire text carries identifiers only** (ticket reference, ids, repo, a one or two sentence
   brief). The routine reads the real ticket from the CRM. This keeps personal data out of
   the fire payload and keeps ticket text clearly marked untrusted.
3. **Start the run in the CRM before firing**, so the 2-runs-per-ticket and daily caps are
   enforced by the CRM and a capped ticket never starts a session.
4. **Rate headroom is fine** for the volume expected (30 fires per hour per routine); n8n
   treats a non-2xx fire response as a failure and sends the ticket to NEEDS_HUMAN.
5. **PRs are attributed to Rhyse's GitHub identity.** Worth knowing before pointing the
   routine at a client's repo; a dedicated machine account would be cleaner later.

## Still to confirm by trying it

- That a fire from n8n starts a session against the attached repo and the routine can reach
  the CRM from the cloud environment (network access settings).
- Time to first event and typical run length, to tune the NEEDS_HUMAN timeout (not built yet:
  a ticket stuck IN_PROGRESS with no events needs a watchdog).
