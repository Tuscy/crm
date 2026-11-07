# Contract: Ticket webhook events (draft)

Events: `ticket.created`, `ticket.message_added`, `ticket.status_changed`, `ticket.assigned`.

Headers: `X-Stky-Signature: sha256=<hex HMAC-SHA256 of raw body>` (same scheme as `apps/app/lib/webhooks/dispatch.ts`), `X-Stky-Delivery: <delivery id, the idempotency key>`, `X-Stky-Event: <event>`.

Body: `{ id, event, createdAt, ticket: { id, reference, clientId, siteId, type, status, priority, agentEligible }, data }`. Never includes secrets or the INTERNAL message text.

Receiver rules (n8n): verify the signature first and drop failures; treat the delivery id as idempotent; respond 2xx within 10 seconds.

Retry: 1m, 5m, 30m, 2h, then dead-letter with a Slack alert. Every attempt is written to `TicketEvent` (`kind: webhook.delivery`).
