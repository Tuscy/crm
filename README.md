# Stky platform (monorepo)

Turborepo + pnpm workspaces: **public site renderer** (`apps/web`), **CRM + builder** (`apps/app`), shared **Prisma** (`packages/db`), UI, sites contracts, and section builder.

## Prerequisites

- Node 18+
- pnpm 9 (`npx pnpm@9.15.0 …` or [corepack](https://nodejs.org/api/corepack.html))
- PostgreSQL for local development

## Setup

```bash
cp .env.example .env
# Set DATABASE_URL, AUTH_SECRET (see Environment variables)

npx pnpm@9.15.0 install
npx pnpm@9.15.0 --filter @stky/db exec prisma migrate deploy
# or for local dev: npx pnpm@9.15.0 db:migrate

# Create a staff user for the CRM (email + password sign-in)
npx pnpm@9.15.0 db:seed
```

## Develop

```bash
# CRM on :3000, public web on :3001
npx pnpm@9.15.0 dev
```

Or per app:

```bash
npx pnpm@9.15.0 --filter @stky/app dev
npx pnpm@9.15.0 --filter @stky/web dev
```

## Staff authentication (`apps/app`)

- Set **`AUTH_SECRET`** (e.g. `openssl rand -base64 32`). **Required in production** on Vercel; the app returns **503** for `/dashboard/*` if auth isn’t configured when `NODE_ENV=production`.
- Run **`pnpm db:seed`** (from `CRM/`) or set `STAFF_SEED_EMAIL` / `STAFF_SEED_PASSWORD` in `.env` before seeding.
- Sign in at `/dashboard/staff-login` with email + password for a user where `isStaff` is true.
- Legacy **`STAFF_DASHBOARD_PASSWORD`** + cookie gate: ignored in production unless **`ALLOW_LEGACY_STAFF_PASSWORD=true`** (emergency only).

If neither `AUTH_SECRET` nor (`STAFF_DASHBOARD_PASSWORD` **and** legacy allowed) is set, the dashboard is **not** gated (**local development only**).

## REST API and automation

- **Preferred:** create **scoped integration keys** in **Dashboard → API keys** (`sk_live_…`). Use `Authorization: Bearer <key>` or `x-api-key: <key>`. Keys are stored hashed; the plaintext is shown once.
- **Legacy:** set **`CRM_API_KEY`** env (single shared key). Still supported for migration; rotate to integration keys when possible.
- Signed-in staff sessions are also accepted for these routes (browser use).

**Edge / abuse protection:** configure **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`** so middleware rate limits apply (see `.env.example`). See **`docs/security/cloudflare-edge.md`** for WAF and Cloudflare rules.

## Outbound webhooks (n8n)

- Set **`CRM_WEBHOOK_URL`** to your n8n **Webhook** node URL and **`CRM_WEBHOOK_SECRET`** to a shared random string.
- CRM sends JSON `POST` bodies with header `X-Stky-Signature: sha256=<hmac>` (HMAC-SHA256 of the body with `CRM_WEBHOOK_SECRET`).
- Events include `lead.created`, `deal.created`, `deal.updated`.

### Local n8n

From `CRM/`:

```bash
docker compose up -d
```

Open **http://localhost:5678**, add a workflow with a **Webhook** trigger, copy the test URL into `CRM_WEBHOOK_URL`, set `CRM_WEBHOOK_SECRET` in `.env`, restart the app, then create a lead in the CRM and confirm the workflow runs.

### CRM Automations page (n8n REST API)

Staff can open **Dashboard → Automations** to list workflows, toggle **active/inactive**, and open workflows in the n8n UI. The CRM calls n8n’s API only from the server (`GET /api/v1/workflows`, `POST .../activate` and `.../deactivate`); the browser never sees `N8N_API_KEY`.

**Environment (set in deployment, not in git):**

| Variable | Purpose |
| -------- | ------- |
| `N8N_BASE_URL` | HTTPS origin of your n8n instance (no trailing slash), e.g. `https://n8n.example.com` |
| `N8N_API_KEY` | Created under n8n **Settings → API** |

If these are unset, the Automations page shows setup instructions instead of failing.

**Infra checklist:**

- Serve n8n on its own host/subdomain with **TLS** (reverse proxy: Caddy, Traefik, Nginx, etc.).
- Ensure the **Next.js server** can reach `N8N_BASE_URL` over HTTPS (VPC or public URL).
- **Back up** n8n’s database/volume separately from the CRM Postgres.
- **Rotate** `N8N_API_KEY` if it leaks; pin n8n Docker image/version and verify API compatibility after upgrades (`/api/v1/docs` on your instance).
- **Webhooks:** inbound CRM events still use `CRM_WEBHOOK_URL` / `CRM_WEBHOOK_SECRET`; webhook workflows must stay **active** in n8n to receive events.

### System status (Uptime Kuma)

The **Dashboard** home shows a **System status** card with a green/red dot per monitor, a red banner across the dashboard while any monitor is down, and a red dot on the Dashboard nav item. The CRM reads Kuma's public status page JSON (`/api/status-page/<slug>` and `/api/status-page/heartbeat/<slug>`) from the server and the browser polls the staff-only `/api/uptime` route every 60 seconds.

| Variable | Purpose |
| -------- | ------- |
| `UPTIME_KUMA_BASE_URL` | HTTPS origin of your Kuma instance (no trailing slash) |
| `UPTIME_KUMA_STATUS_SLUG` | Slug of a **published** Kuma status page containing the monitors to show |

Only monitors added to that status page appear. If these are unset, the card shows setup hints and no banner appears. "Was down" notes are limited to the recent checks Kuma returns (roughly the last 100 per monitor).

## Analytics (GA4 & Search Console)

- **`AnalyticsCredential`** (canonical) stores encrypted OAuth **`refreshToken`**, property/site **`accountId`**, and optional **`clientId`** (null = org-level fallback). Connect via **`/dashboard/settings/analytics`**.
- Legacy **`AnalyticsConnection`** is deprecated; new integrations should use **`AnalyticsCredential`** only.
- Configure **`GOOGLE_CLIENT_ID`**, **`GOOGLE_CLIENT_SECRET`**, **`GOOGLE_OAUTH_REDIRECT_URL`**, and **`ENCRYPTION_KEY`** in `.env`.
- Unified reporting: **`/dashboard/reporting`**. GA4/GSC API routes under **`/api/analytics/`**.
- **`GET /api/analytics`**: without `clientId`, requires **client portal** session. With `clientId`, requires **staff session** or integration key with `analytics:read` scope.

## Google Ads

- Staff UI: **`/dashboard/google-ads`** (overview) and **`/dashboard/google-ads/settings`** (MCC + account mappings).
- Server env: **`GOOGLE_ADS_DEVELOPER_TOKEN`**, **`GOOGLE_ADS_CLIENT_ID`**, **`GOOGLE_ADS_CLIENT_SECRET`**, **`GOOGLE_ADS_REFRESH_TOKEN`** (same agency credentials as the `google-ads/` sandbox).
- DB: **`GoogleAdsSettings`** (MCC ID), **`GoogleAdsConnection`** (optional CRM client ↔ Ads customer ID; multiple Ads accounts per client supported).
- See **`docs/google-ads.md`** for API routes and migration steps (`pnpm db:migrate`).

## Observability

- Server code emits one-line JSON logs via `logStky` (`apps/app/lib/observability.ts`) for API `401`s, forbidden scope, portal email failures, integration keys changes, and webhook failures.
- Optional production error reporting: add **`@sentry/nextjs`** and `SENTRY_DSN` (not wired by default).
- **`docs/security/INCIDENT-RUNBOOK.md`** — credential rotation and incident checklist.

## Packages

| Package         | Role                                      |
| --------------- | ----------------------------------------- |
| `@stky/db`      | Prisma schema, migrations, `prisma` export |
| `@stky/ui`      | Shared shadcn-style primitives            |
| `@stky/sites`   | Zod + section payload types               |
| `@stky/builder` | `SectionRenderer`, Hero / Cta / Text      |
| `@stky/crm`     | Pipeline stages, lead statuses, validation |
| `@stky/auth`    | Portal session (`membershipId` cookie)    |
| `@stky/security` | Rate limiting (Upstash), API key helpers, shared security headers |

## Notes

- **Workspace root**: Run all commands from this folder (`CRM/`).
- **Public sites**: map `customDomain` / `subdomain` + `ROOT_DOMAIN`, or use `?siteId=` / `DEV_SITE_ID` on localhost (`apps/web`).
- **Client portal**: passwordless **magic link** to email (15-minute token); httpOnly session cookie after verify. Configure **`RESEND_API_KEY`** + **`RESEND_FROM_EMAIL`** for production email; in development, the magic link URL is logged when Resend is unset.
- **Pre-monorepo** code is under `_legacy-pre-monorepo/` for reference only.
