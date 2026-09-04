# Deployment Runbook

Operational procedure for deploying and running Ravish Astro in production.

Everything here is **procedure**, not automation. Nothing in this document has
been executed against real production infrastructure, because no production
environment, hosting account or provider credentials exist in this repository
yet. Items that require a real environment to confirm are marked
**NOT VERIFIED**.

## Required production configuration

Deployment fails fast rather than starting half-configured.
`assertProductionAuthEnv()` in `src/config/env.ts` throws on boot when a
required value is missing. It names the missing variable and never prints a
value.

| Variable | Class | Notes |
| --- | --- | --- |
| `DATABASE_URL` | server-only secret | Postgres connection string |
| `BETTER_AUTH_SECRET` | server-only secret | `AUTH_SECRET` accepted as a legacy alias |
| `BETTER_AUTH_URL` | server-only | Public origin used to build OAuth callbacks |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | server-only secret | Must be set together or neither |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | server-only secret | Distributed rate limiting; production refuses to start without them |
| `TRUSTED_PROXY_PLATFORM` | server-only | Deployment topology; see "Proxy trust" below |
| `NEXT_PUBLIC_SITE_URL` | build-time public | The only public variable. Safe to ship to the browser |
| `RAZORPAY_KEY_ID` | server-only, public-ish | Only value that may reach the checkout client |
| `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | server-only secret | Required when `REPORT_CHECKOUT_ENABLED=true` |
| `AI_PROVIDER_API_KEY` | server-only secret | Required when `AI_PROVIDER=gemini` |
| `JOBS_SECRET` | server-only secret | Report worker; worker disabled when unset |
| `STORAGE_*` | server-only secret | Report PDF object storage |
| `TRUSTED_PROXY_HOPS`, `LOG_LEVEL` | optional | Defaults documented in `.env.example` |

Secrets belong in the hosting platform's secret store or a managed secret
manager. They must never be committed, printed in logs, or exposed through
`NEXT_PUBLIC_*`.

## Proxy trust

Rate limiting keys on client identity, so `TRUSTED_PROXY_PLATFORM` is a
security setting, not a preference. `X-Forwarded-For` is appended to by each
hop: entries on the left come from the client and can be forged. Setting this
wrongly either lets a caller mint unlimited fresh rate-limit buckets or lumps
every visitor into one.

- `vercel` / `cloudflare` / `fly` — trust that platform's own client-IP header,
  which the edge overwrites on every request.
- `generic` — behind your own reverse proxy. Also set `TRUSTED_PROXY_HOPS` to
  the number of proxies you control.
- `none` (default) — trust nothing. Safe, but every anonymous caller shares one
  bucket.

## Deploy

1. **Pre-deploy checks** — on the release commit:
   ```bash
   pnpm test
   pnpm typecheck
   pnpm lint
   pnpm prisma validate
   pnpm build
   ```
2. **Environment validation** — confirm every required variable above is present
   in the target environment. Presence only; never echo values.
3. **Database backup / checkpoint** — take a snapshot and record its identifier
   before any migration. See `docs/database-operations.md`.
4. **Migrate**:
   ```bash
   pnpm prisma migrate deploy
   pnpm prisma migrate status   # must report "up to date"
   ```
   Never run `prisma migrate dev` against production: it is interactive and can
   reset the database.
5. **Deploy the application version.**
6. **Verify health and readiness**:
   ```bash
   curl -fsS https://<host>/api/health      # {"status":"ok"} — process is alive
   curl -fsS https://<host>/api/readiness   # {"status":"ok"} — database + rate-limit store reachable
   ```
   Readiness returns `503` with `{"status":"unavailable","failed":[...]}` naming
   which check failed, and nothing else.
7. **Smoke tests** — homepage renders; sign-in works; `/transits` shows nine
   planets; an admin route returns `404` for an anonymous visitor; a product
   page loads. If checkout is enabled, run one Razorpay **test-mode** payment
   end to end.

## Rollback

1. **Application** — redeploy the previous release. The app is stateless, so
   this is the fast path and should be the first action.
2. **Database** — Prisma migrations have no automatic down-migration. A
   forward-only fix is almost always safer than restoring a backup, because a
   restore discards every write since the snapshot, including real customer
   orders and payments.
3. **Migration recovery** — if a migration is partially applied, `prisma migrate
   status` reports it. Resolve deliberately with `prisma migrate resolve`; do
   not hand-edit `_prisma_migrations`.
4. **Payment considerations** — never roll back to a schema version that cannot
   record a payment. Razorpay will retry webhooks for a period, so an endpoint
   that is briefly down recovers on its own. Because `PaymentWebhookEvent.providerEventId`
   is unique, replayed events are safely ignored rather than double-applied.
5. **Rolling back a release that changed report generation** — in-flight
   `GeneratedReport` rows keep their state; the admin retry path re-queues them
   without recharging the customer.

## Incident checks

**Payment failures.** Look for `incident: payment_webhook_failure` and
`payment_signature_failure`. A burst of signature failures usually means a
webhook secret was rotated on one side only. Confirm the order's true state with
Razorpay before touching anything: an order is only ever marked paid by a
verified webhook, never by a browser callback.

**Webhook failures.** `payment_webhook_duplicate` at info level is normal —
providers retry until acknowledged. Repeated `payment_webhook_failure` for the
same `providerEventId` means processing raised after the event row was written;
the event is recorded, so it can be reprocessed once the cause is fixed.

**Redis / rate-limit-store outage.** `incident: rate_limit_store_outage` carries
`policy` and `protectionDisabled`. This matters: auth and admin namespaces fail
**open**, so while the store is down, brute-force protection on sign-in is not
being enforced. Treat a sustained outage as a security event, not just an
availability one. Payment, AI and astrology namespaces fail **closed** and will
reject requests until the store returns.

**Database outage.** `/api/readiness` returns `503` with `failed: ["database"]`.
`/api/health` deliberately stays `200`: restarting a healthy process never fixes
a database, and doing so during an incident only removes capacity.

**Gemini / AI outage.** `incident: ai_generation_failure` with a category and
whether it is retryable. Report orders stay paid and recoverable; generation is
retried by an operator from `/admin`, which reuses the existing order, its price
snapshot and its immutable `AstrologyCalculation`, and never charges again.

**Authentication failures.** Check `BETTER_AUTH_URL` matches the deployed
origin and that the Google callback URL is registered. Cookies are `HttpOnly`,
`SameSite=Lax`, and `Secure` only in production — a site served over plain HTTP
in "production" mode will appear to lose sessions.

**Elevated 429s — check which limiter fired first.** There are two, and they
are distinguishable from the response alone. Better Auth ships its own
credential limiter that activates in production and is considerably stricter
(roughly 3 requests per 10 seconds on sign-in); it answers with
`x-retry-after` and a body of `{"message":"Too many requests. Please try again
later."}`. The application's distributed limiter answers with `Retry-After` and
`{"error":"Too many attempts. Please try again shortly."}`, and logs a
`rate_limit` event naming the namespace and limit. A user reporting an
unexpected sign-in block during normal use is almost always hitting Better
Auth's window, not `RATE_LIMITS`. Verified by observation on a production
build.

Otherwise, elevated 429s are expected during an attack. `rate_limit` events carry the
namespace and outcome but deliberately never the identifier, so they cannot be
used to profile who was limited. If legitimate users are affected, adjust the
threshold in `RATE_LIMITS` (`src/lib/security/rate-limit.ts`) — every limit and
its rationale is declared in that one table.

## Status of this runbook

| Item | Status |
| --- | --- |
| Environment validation fails fast on missing config | AUTOMATED TESTED |
| Health and readiness endpoints respond correctly | BROWSER / HTTP VERIFIED (local) |
| Readiness reports `503` naming the failed check | STRUCTURALLY VERIFIED |
| `prisma migrate deploy` procedure | STRUCTURALLY VERIFIED — **NOT VERIFIED** against production |
| Backup and restore | **NOT VERIFIED** — see `docs/database-operations.md` |
| Rollback procedure | **NOT VERIFIED** — no production environment exists |
| Razorpay test-mode smoke test | **NOT EXECUTED** — no test credentials available |
| Structured JSON logging in production | **PRODUCTION-LIKE VERIFIED** on a production build |
| Readiness `503` names only the failed check | **PRODUCTION-LIKE VERIFIED** — no host, URL, credential or stack trace in the body |
| Database outage → readiness `503`, health `200` | **REAL-INFRASTRUCTURE VERIFIED** — Postgres stopped and restarted |
| Recovery after database returns | **REAL-INFRASTRUCTURE VERIFIED** — no application restart required |
| Rate-limit store outage → fail-open with `protectionDisabled` | **PRODUCTION-LIKE VERIFIED** |
| Rate-limit store outage → money paths fail closed | **PRODUCTION-LIKE VERIFIED** — user-visible message leaks no internals |
| One distributed bucket shared across instances | **PRODUCTION-LIKE VERIFIED** — two processes, one store |
| Spoofed `X-Forwarded-For` yields no extra buckets | **PRODUCTION-LIKE VERIFIED** |
| Backup and restore | **REAL-INFRASTRUCTURE VERIFIED** — see `docs/database-operations.md` |


## Verifying the distributed rate-limit store

Before trusting a new environment's rate limiting, confirm the store is actually
shared rather than per-instance. A per-process counter looks healthy and
enforces nothing across a fleet.

1. `curl -fsS https://<host>/api/readiness` must return `{"status":"ok"}`.
   A body of `{"status":"unavailable","failed":["rateLimitStore"]}` means the
   store is unset or unreachable, and production refuses to fall back to an
   in-process counter by design.
2. Send requests to the same credential endpoint through two different
   instances and confirm the limit is consumed **once in total**, not once per
   instance. If each instance has its own allowance, the store is not shared.
3. Confirm keys expire: a bucket must reset at the end of its window.

This was verified on a production build with two processes against one store.

## Proxy topology

`TRUSTED_PROXY_PLATFORM` decides which header identifies a client, and getting
it wrong silently disables IP-based rate limiting.

After deploying, verify with a request carrying a forged forwarding header:

```bash
curl -s -o /dev/null -X POST https://<host>/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -H 'X-Forwarded-For: 10.0.0.1, 203.0.113.1' \
  -d '{"email":"probe@example.test","password":"wrong"}'
```

Repeat with different left-hand entries. Every one must land in the same bucket:
the limit should be consumed as though it were one caller. If varying the header
grants a fresh allowance each time, the platform or hop count is misconfigured
and the limiter is effectively off. Verified on a production build: fifteen
forged identities produced exactly one bucket.
