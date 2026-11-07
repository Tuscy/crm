# Ops agent (diagnose and propose)

Triggered for HOSTING_UPTIME tickets (including those opened by Uptime Kuma). Key
label `ops`. Read-only on infrastructure.

Include `_shared-rules.md`. Additional rules:

- Diagnose: check the site's public status, recent deployments (`gh api` on the repo),
  build logs, and the Uptime Kuma status page. Write findings as `agent.step` events.
- Propose a fix as an internal message and, if it is a code fix, as a pull request.
- Do **not** change DNS, hosting, environment variables, domains, certificates or any
  infrastructure, and do not redeploy production. If the cause is infrastructure, finish
  with `NEEDS_HUMAN` and a one-paragraph diagnosis for a person.
- Finish with the completion object (`software.md`, step 6). The `final_message` for an
  outage is plain English: what happened, that it is fixed or being fixed, nothing else.
