# Database Operations

Backup, restore and migration procedure for the Postgres database.

**Nothing in this document has been executed against a real production
database.** No managed database, hosting account or infrastructure credentials
exist in this repository. Every item below is written procedure. A restore is
only real once it has been performed and verified, and that has **NOT** been
done.

## Connection strategy

`src/lib/db/prisma.ts` creates one `PrismaClient` per process, bound to the
`@prisma/adapter-pg` driver adapter that Prisma 7 requires. In development the
instance is cached on `globalThis` so hot reloads do not open a new pool per
reload. In production it is created once at module load, so a long-running
server holds exactly one pool.

**Serverless caution.** On a platform that runs many short-lived instances,
each instance opens its own pool, and Postgres connection limits are per
cluster rather than per instance. Deploying serverless without a pooler in
front is the most likely way to exhaust connections under load.

- Long-running server (container, VM): connect directly.
- Serverless / edge-scaled: put a pooler in front — PgBouncer in transaction
  mode, or the provider's built-in pooler (Supabase, Neon, RDS Proxy) — and
  point `DATABASE_URL` at the pooler endpoint. Keep a direct connection string
  for migrations, which need a session-mode connection.

Transaction boundaries are already explicit: every multi-statement invariant
(order creation, inventory commit, role change, audit writes) runs inside
`prisma.$transaction`, so a pooler in transaction mode is safe.

## Backup

| Item | Assumption |
| --- | --- |
| Mechanism | Managed provider automated snapshots, plus `pg_dump` before each deploy that carries a migration |
| Frequency | Daily automated snapshot; on-demand checkpoint before every migration |
| Retention | 30 days of daily snapshots (assumption — confirm against the provider plan actually purchased) |
| Encryption | At rest, by the provider |
| Location | Same region as the database, with the provider's cross-region copy enabled if available |

On-demand checkpoint before a migration:

```bash
pg_dump --format=custom --no-owner --no-acl \
  --file="Tarun-$(date -u +%Y%m%dT%H%M%SZ).dump" "$DATABASE_URL"
```

Record the resulting filename and the deployed commit together. A backup whose
matching application version is unknown is much harder to use in an incident.

## Restore

1. **Stop writes.** Scale the application to zero or put it in maintenance.
   Restoring underneath a live app produces a split-brain state.
2. **Restore into a new database first**, never over the live one:
   ```bash
   createdb Tarun_restore
   pg_restore --no-owner --no-acl --dbname=Tarun_restore Tarun-<timestamp>.dump
   ```
3. **Verify the restored database** before pointing anything at it:
   ```bash
   psql "$RESTORE_URL" -c "select count(*) from \"User\";"
   psql "$RESTORE_URL" -c "select count(*) from \"Order\";"
   psql "$RESTORE_URL" -c "select count(*) from \"Payment\" where status = 'CAPTURED';"
   psql "$RESTORE_URL" -c "select max(\"createdAt\") from \"AuditLog\";"
   ```
   Confirm the captured-payment count and the latest audit entry match what the
   business expects for that point in time. A restore that silently loses paid
   orders is worse than the outage.
4. **Check migration state** against the restored database:
   ```bash
   DATABASE_URL="$RESTORE_URL" pnpm prisma migrate status
   ```
   The snapshot carries whatever migrations were applied when it was taken.
   - Behind the application version: run `prisma migrate deploy` to bring it
     forward before serving traffic.
   - Ahead of it: deploy the matching newer application version instead of
     rolling the schema back.
5. **Repoint and restart.** Update `DATABASE_URL`, redeploy, then verify
   `/api/readiness` returns `{"status":"ok"}`.

## Migration deployment

Production uses `prisma migrate deploy`, which applies pending migrations
non-interactively and never resets. `prisma migrate dev` is for local work only:
it is interactive and can drop the database.

```text
backup / checkpoint
  → pnpm prisma migrate deploy
  → pnpm prisma migrate status   (must say up to date)
  → deploy application version
  → curl /api/readiness
  → smoke test
```

Because this repository generates migrations with
`prisma migrate diff --from-config-datasource --to-schema=... --script`, review
the generated SQL before committing it. Grep every new migration for:

```text
DROP TABLE   DROP COLUMN   TRUNCATE   DELETE FROM   ALTER COLUMN
```

Each hit must be justified in the pull request. `ALTER COLUMN` deserves specific
attention: a type narrowing or a new `NOT NULL` on a populated table can fail
mid-deploy or silently truncate.

Prefer expand-then-contract for anything destructive: add the new column, deploy
code that writes both, backfill, deploy code that reads the new one, and only
then drop the old column in a later release. That keeps every step reversible by
redeploying the previous application version.

## Emergency rollback

1. Redeploy the previous application version first. It is stateless and fast.
2. Prefer a forward fix over a database restore. A restore discards every write
   since the snapshot, including real orders and payments.
3. Restore from backup only when data is genuinely corrupt, and follow the
   restore procedure above — into a new database, verified, then repointed.
4. After any restore, reconcile payments against Razorpay before resuming
   fulfilment. Provider records are authoritative for what was actually charged.

## Verification status

| Item | Status |
| --- | --- |
| Connection strategy and transaction boundaries | STRUCTURALLY VERIFIED (code reviewed) |
| Migration history has no destructive SQL | AUTOMATED — audited, see Phase 9 report |
| `prisma migrate status` reports up to date | VERIFIED locally |
| Backup procedure | **REAL-INFRASTRUCTURE VERIFIED** against a non-production Postgres 16 — see drill below |
| Restore procedure | **REAL-INFRASTRUCTURE VERIFIED** — a restore was actually performed and checked |
| Pooler configuration | **NOT VERIFIED** — deployment target not chosen |


## Backup / restore drill (executed)

A real drill was run against a non-production Postgres 16.14 instance. This is
an executed restore, not a written procedure. It has **not** been run against
production, which does not exist yet.

### Method

1. Seeded deterministic, clearly-synthetic fixtures: a user, a product with
   inventory, a PAID order with a JSON shipping-address snapshot, an audit
   entry, and a processed `PaymentWebhookEvent`. No real customer data.
2. `pg_dump --format=custom --no-owner --no-acl`.
3. Created a **separate empty** database and restored into it with
   `pg_restore`. The source database was never overwritten.
4. Verified counts and field values, then ran the application against the
   restored database.

### Observed timings

These are drill observations on a local container, **not an RTO commitment**.
Real infrastructure with production data volume will differ substantially.

| Step | Observed |
| --- | --- |
| Backup (`pg_dump`) | 193 ms, 121.8 KB dump |
| Restore (`pg_restore`) | 227 ms, 0 → 40 tables |
| Application verification | ~2.3 s |

### Result

Every seeded value survived exactly: counts matched, and the order's status,
currency, `paidAt` timestamp and JSON address snapshot round-tripped unchanged.
Against the restored database, `prisma validate` passed and `prisma migrate
status` reported "up to date", confirming migration state travels with the dump.

The application served `/`, `/shop`, the restored product page, `/sign-in`,
`/reports` and `/transits` from the restored data, and still returned `404` on
every `/admin` route for an anonymous visitor, so authorization survived the
restore.

`/api/readiness` returned `503` naming `rateLimitStore`, because that drill
process had no distributed store configured. That is the intended production
guard, not a restore defect.

### Cleanup

The temporary restored database and the dump file were destroyed after
verification, and the synthetic fixtures were removed from the source database.
