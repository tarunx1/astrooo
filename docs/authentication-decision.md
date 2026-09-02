# Authentication decision

Status: accepted — 2 September 2026
Scope: authentication, customer account, saved birth profiles, saved Kundlis

## Decision

Ravish Astro uses **Better Auth 1.7.2** with the Prisma adapter and database-backed sessions.

## Why Better Auth and not Auth.js

The choice was made against the npm registry on the day of the decision, not from
examples:

| Package | `latest` | Notes |
| --- | --- | --- |
| `better-auth` | **1.7.2** | Stable release line |
| `next-auth` | 4.24.15 | Pages-router era; not the App Router design |
| `next-auth` (`beta`) | 5.0.0-beta.32 | Auth.js v5 is still beta |

Auth.js v5 is the version that targets the App Router, and it remains a beta.
Shipping production authentication and customer data on a beta dependency is not
an acceptable risk for this platform, so Better Auth is the choice. Supporting
reasons:

- It is framework-agnostic with a first-class Next.js App Router integration
  (`better-auth/next-js`), which matters on Next.js 16 where Middleware has been
  renamed to Proxy and route conventions moved.
- Email OTP / magic link and phone OTP are first-party plugins, which is exactly
  the extension path this phase must leave open.
- Its Prisma adapter targets a schema we control, so the auth tables live in the
  same migration history as the rest of the platform.

Only one auth framework is installed. `next-auth` is not a dependency.

## Session strategy

Database-backed sessions, not JWTs.

- A `Session` row is the source of truth; the cookie carries only an opaque token.
- Cookie flags: `HttpOnly`, `SameSite=Lax`, and `Secure` whenever
  `NODE_ENV === "production"` (see `advanced.useSecureCookies` in
  `src/lib/auth/auth.ts`).
- Session lifetime is 30 days with a 1-day refresh window.
- A 5-minute signed cookie cache avoids a database read on every request. It is
  also `HttpOnly`, so it is not readable from JavaScript.
- Sessions can be revoked server-side by deleting the row — not possible with a
  stateless JWT.

Nothing sensitive is stored in `localStorage`, and provider access/refresh tokens
never leave the server.

## Prisma integration

Better Auth 1.7 expects `user`, `session`, `account` and `verification` models
with specific field names. The pre-existing schema used Auth.js-style naming
(`provider`, `providerAccountId`, `sessionToken`, `emailVerified DateTime?`), so
those three models were rewritten to the shapes Better Auth actually reads:

- `Account` now uses `issuer`, `accountId`, `providerId`, `accessToken`,
  `refreshToken`, `idToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`,
  `scope`, `password`, with `@@unique([issuer, accountId])`.
- `Session` now uses `token` (unique), `expiresAt`, `ipAddress`, `userAgent`.
- `User.emailVerified` changed from `DateTime?` to `Boolean`, and `name` from
  `String?` to a required `String`.
- `Verification` was added.

All existing business relations on `User` (addresses, orders, consultations,
reviews, wishlist, birth profiles, …) were preserved, as were `role` and `phone`.
There was no migration history and no data at the time of the change, so this was
a schema correction rather than a destructive migration.

Prisma 7 requires an explicit driver adapter. `src/lib/db/prisma.ts` is the only
place a `PrismaClient` is constructed, using `@prisma/adapter-pg`.

## Supported providers

- **Google OAuth** — the production sign-in method. Registered only when both
  `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are present, so a misconfigured
  environment fails visibly instead of silently offering a broken button.
- **Development credentials** — email/password, enabled only when
  `NODE_ENV !== "production"` *and* `ENABLE_DEV_CREDENTIALS=true`. This exists so
  automated tests and local work can exercise authenticated surfaces without live
  Google credentials. It is impossible to enable in production.
- **Email magic link / OTP and phone OTP** — not implemented. No email
  infrastructure is configured, and faking delivery would be worse than absence.
  The sign-in UI already lists them as forthcoming so adding them is a plugin
  registration plus a panel section, not a redesign.

The sign-in UI is provider-neutral: Google is presented as one option among
several rather than as the sign-in experience itself.

## Security assumptions

1. **The server session is the only source of the acting user id.** No server
   action or query accepts a `userId` from the browser.
2. **Authorization is enforced in the query, not after it.** Ownership-scoped
   reads and writes use `where: { id, userId }`, so an id belonging to someone
   else matches zero rows and behaves as "not found". This closes IDOR by
   construction rather than by a comparison that can be forgotten.
3. **Server Actions are public endpoints.** Every mutation authenticates,
   validates with Zod, authorizes, and only then executes.
4. **Proxy is not an authorization boundary.** The Next.js 16 documentation is
   explicit that Proxy (formerly Middleware) should not be used as a full session
   or authorization solution, so all enforcement lives in server components and
   server actions.
5. **Return URLs are validated against an allowlist shape.** Only same-origin,
   path-absolute destinations are honoured; absolute URLs, protocol-relative
   URLs, scheme payloads, backslash variants, encoded separators and control
   characters all collapse to a safe default.
6. **A result URL is a capability, not an ownership claim.** Knowing a Kundli
   result UUID lets you view it — that is how anonymous results work — but never
   to attach it to an account. Claiming additionally requires a signed,
   short-lived, HttpOnly continuation cookie naming that exact calculation.
7. **Birth data never enters a URL.** The continuation carries only the opaque
   calculation id.

## Ownership model for shared calculations

`AstrologyCalculation` is globally deduplicated by input hash
(`@@unique([calculationType, inputHash, provider, calculationVersion])`), so one
calculation row can be reached by any number of people who entered identical
birth details.

Ownership therefore cannot live on the calculation. A `SavedKundli` join model
records `(userId, birthProfileId, calculationId)`. When a user saves a Kundli
they receive **their own copy** of the birth profile; the original profile is
never re-pointed or re-owned. This is what prevents one user's save from
capturing another user's data, and it is covered by cross-user tests.

## Deletion policy

- Deleting a `BirthProfile` cascades to that user's `SavedKundli` rows, which are
  per-user bookmarks.
- `AstrologyCalculation` rows are **retained**, with `birthProfileId` set to null
  (`onDelete: SetNull`). They are the auditable record of a real calculation and
  future paid reports will reference them, so they must outlive a profile
  deletion.
- `SavedKundli.calculation` uses `onDelete: Restrict` so a calculation cannot be
  removed while a user still references it.

## Google OAuth setup

1. In the Google Cloud console create an OAuth 2.0 Client ID of type *Web
   application*.
2. Add the authorised redirect URIs:
   - local: `http://localhost:3000/api/auth/callback/google`
   - production: `https://<your-domain>/api/auth/callback/google`
3. Put the client id and secret in the environment (never in the repository):

```bash
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
BETTER_AUTH_SECRET="<a long random string>"
BETTER_AUTH_URL="https://<your-domain>"
DATABASE_URL="postgresql://..."
```

`BETTER_AUTH_SECRET` must be set in production; the application refuses to start
with a weak or missing secret there. `GOOGLE_CLIENT_SECRET` is server-only and is
never sent to the browser.

## Future extensibility

- Email magic link / OTP: register the Better Auth `emailOTP` or `magicLink`
  plugin and implement `src/lib/email/provider.ts`.
- Phone OTP: register the `phoneNumber` plugin; `User.phone` already exists.
- Roles: `User.role` is present and exposed on the session as a read-only
  additional field, ready for an admin surface.
- Account routes `/account/reports`, `/account/orders`, `/account/consultations`
  and `/account/wishlist` are already reserved in
  `src/config/account-navigation.ts` as `status: "planned"`.
