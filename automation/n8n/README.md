# n8n workflow: StickySites ticket agents

`ticket-agents.json` is one importable workflow with two entry points. **It has been
written and structurally checked but not yet imported into a running n8n or run end to
end.** Import it into a test n8n first, switch it on only when the checks below pass.

## Entry points

1. **`POST /webhook/ticket-events`** receives the CRM's signed events. It verifies
   `X-Stky-Signature` (HMAC-SHA256 of the raw body) and drops anything that fails with
   401, replies 200 straight away, then routes:
   - `ticket.created` (not from an agent) goes to **triage** (`../agents/triage.md`).
   - `ticket.assigned` to agent `software` on an agent-eligible ticket goes to the
     **software agent**: find repo, start an agent run (the CRM enforces 2 runs per
     ticket and the daily caps; a 429 sends the ticket to NEEDS_HUMAN), create a GitHub
     issue, fire the Claude Code routine, mark IN_PROGRESS.
   - everything else is ignored, including every event an agent caused, so agents can't
     trigger each other in a loop.
2. **`POST /webhook/github-pr`** receives GitHub `pull_request` events. A merged PR from a
   `claude/tkt-NNNN` branch asks the CRM to move that ticket to RESOLVED.

## Environment variables n8n needs

| Variable | What it is |
|---|---|
| `CRM_BASE_URL` | The CRM's public URL, no trailing slash |
| `CRM_N8N_KEY` | A CRM integration key with scope `tickets:write` and label `n8n` |
| `TICKET_WEBHOOK_SECRET` | Same value as the CRM's `TICKET_WEBHOOK_SECRET` |
| `ANTHROPIC_API_KEY` | For the triage call |
| `TRIAGE_MODEL` | Model id for triage, e.g. a small fast Claude model |
| `GITHUB_TOKEN` | Fine-grained token with Issues: write on the client repos only |
| `GITHUB_WEBHOOK_SECRET` | Secret configured on the GitHub webhook |
| `SOFTWARE_ROUTINE_TRIGGER_ID` | The `trig_...` id from the routine's API trigger |
| `SOFTWARE_ROUTINE_TOKEN` | The routine's bearer token (shown once when generated) |

n8n must allow env access in expressions (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`) and the
Code nodes need `NODE_FUNCTION_ALLOW_BUILTIN=crypto`.

## Before switching on

- Fill `REPO_MAP` in the **Find repo** node (siteId to `owner/name`, from `ops/registry`).
  Unknown sites go to NEEDS_HUMAN rather than guessing.
- Create the CRM keys in Settings → API keys: `n8n` (`tickets:write`) and `software`
  (`tickets:agent`, this one goes into the routine's cloud environment, not into n8n).
- Create the routine from `../agents/software.md`, attach one repo, add the API trigger.
- Set the CRM's `TICKET_WEBHOOK_URL` to this workflow's production webhook URL and
  `CRON_SECRET` in Vercel so retries run.
- Test with a throwaway ticket on a throwaway repo before any client site.
