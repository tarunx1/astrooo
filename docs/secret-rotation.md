# Secret Rotation and Credential Incidents

What to do when a credential is exposed — committed, pasted, logged, or found in
a screenshot.

No automatic rotation exists. Every procedure here is manual, because the
infrastructure to automate it has not been chosen yet. Nothing in this document
has been executed against production: there is no production environment.

## General rule

Rotate first, investigate second. A leaked credential is cheap to replace and
expensive to leave live. Never "wait and watch" a secret that has been exposed.

Order of operations for every credential:

1. **Issue a replacement** at the provider before revoking the old one, so there
   is no gap in service where both are invalid.
2. **Update the secret store** (hosting platform secrets or secret manager).
3. **Redeploy** so running instances pick it up. Most of these are read at
   module load, so a config change alone does not take effect.
4. **Revoke the old credential** at the provider.
5. **Verify** `/api/readiness` returns `{"status":"ok"}` and run the smoke tests
   in `deployment-runbook.md`.
6. **Inspect logs** for use of the old credential after the exposure window.
7. **Purge the exposure** — if it reached git history, rotating is mandatory and
   removing the commit is secondary. Assume anything pushed was harvested.

## Per credential

### `RAZORPAY_KEY_SECRET`

Rotate in the Razorpay dashboard. Payment verification and order creation fail
while the value is stale, and the key id changes with it, so
`RAZORPAY_KEY_ID` must be updated in the same deploy. After rotating, reconcile
any orders created in the exposure window against the provider before
fulfilling them.

### `RAZORPAY_WEBHOOK_SECRET`

Rotate in the webhook settings. Signature verification will reject deliveries
signed with the old secret, so expect `payment_signature_failure` incidents
during the changeover. Razorpay retries, so events signed after the change are
processed once the new secret is live — the `providerEventId` unique constraint
prevents any double application. Do not disable verification to "catch up".

### `AI_PROVIDER_API_KEY` (Gemini)

Rotate in the provider console. Report generation fails explicitly while stale;
paid report orders remain recoverable and can be retried from `/admin` without
recharging the customer. Check provider billing for usage in the exposure
window.

### `UPSTASH_REDIS_REST_TOKEN`

Rotate in Upstash. Until the new token is deployed, the store is unreachable:
money-spending paths fail closed and auth/admin fail open, so **brute-force
protection is not enforced during the gap**. Treat a leaked Redis token as a
security incident with a short deadline, not a routine rotation. Watch for
`rate_limit_store_outage` incidents with `protectionDisabled: true`.

### `BETTER_AUTH_SECRET`

Rotating this invalidates existing sessions — every signed-in user is signed
out. That is the correct outcome for a leaked auth secret, because the old value
could be used to forge sessions. Do it deliberately, and communicate it if the
user base is large enough to notice. `AUTH_SECRET` is a legacy alias and must be
rotated at the same time if it is set.

### `DATABASE_URL`

Rotate the database password at the provider and update the connection string.
If a pooler is in front, update it too. After rotation, review database logs for
connections from unexpected addresses during the exposure window, and consider
whether a restore point is needed (see `database-operations.md`).

### `GOOGLE_CLIENT_SECRET`

Rotate in the Google Cloud console. Sign-in through Google fails until the new
value is deployed; existing sessions are unaffected because they are database
sessions, not Google tokens.

### `JOBS_SECRET`

Rotate and redeploy. The report worker is refused until it matches, which is the
safe direction — generation stalls rather than running unauthenticated.

### `STORAGE_SECRET_ACCESS_KEY`

Rotate at the object-storage provider. Report downloads use short-lived signed
URLs, so links already issued may continue to work until they expire; that is
expected and not a reason to skip rotation.

### SMTP / `EMAIL_PROVIDER_API_KEY`

Rotate at the email provider. A leaked sending credential is commonly abused for
phishing under your domain, so treat it as urgent and check the provider's
outbound logs for messages you did not send.

## Preventing recurrence

- Secrets belong only in the platform secret store. `.env` is git-ignored and
  must stay that way.
- `NEXT_PUBLIC_*` is the only prefix that reaches the browser. Never put a
  secret behind it. `RAZORPAY_KEY_ID` is publishable by design; the key secret
  is not.
- Application logs pass through key-based redaction, and error messages name a
  missing variable without printing its value. Keep it that way when adding new
  configuration.
- Scan staged changes before committing anything that touches configuration.

## Status

| Item | Status |
| --- | --- |
| Procedures documented | Yes |
| Rotation executed against production | **NOT VERIFIED** — no production environment |
| Automated rotation | Not implemented; no supporting infrastructure chosen |
