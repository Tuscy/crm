# Contract: Tickets API (draft)

Auth: `Authorization: Bearer <key>` or `x-api-key`, or a staff session with the `ticket` permission. Ticket routes never accept the legacy `CRM_API_KEY`.

| Method and path | Scope | Notes |
|---|---|---|
| `POST /api/tickets` | `tickets:write` or `tickets:intake` | Intake keys are bound to one site; `clientId`/`siteId` come from the key, not the body |
| `GET /api/tickets` | `tickets:read` | Filter by client, status, type |
| `GET /api/tickets/:id` | `tickets:read` | Returns clean view; `?include=log` needs staff or `tickets:agent` |
| `PATCH /api/tickets/:id` | `tickets:write` | Fields other than status |
| `POST /api/tickets/:id/events` | `tickets:agent` | Append log events; redacted server-side |
| `POST /api/tickets/:id/messages` | `tickets:agent` or `tickets:write` | `visibility` PUBLIC or INTERNAL |
| `POST /api/tickets/:id/status` | `tickets:agent` or `tickets:write` | Requests a transition; body `{ to, status, summary, final_message? }`; refused if not allowed |

Create body: `{ title, description, type?, requester: { name, email }, source }`.
Errors: 401 no key, 403 wrong scope or wrong site, 409 invalid transition, 422 validation, 429 rate limited.
