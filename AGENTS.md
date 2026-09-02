<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Ravish Astro Product Rules

- Never calculate astronomy or Vedic astrology positions with an LLM.
- Provider results must map into internal domain types before reaching UI.
- Private Kundli result pages must be marked `noindex`.
- Birth details are private customer data; do not put DOB, time, or location in public URLs.
- Provider-specific response types must not leak into UI components.
- Calculation metadata and versioning must be stored with Kundli/report results.
- The approved homepage is visually frozen unless a redesign is explicitly requested.

## Authentication, Accounts and Private Data

- The approved homepage, `/kundli` and Kundli result UI are visually frozen unless a redesign is explicitly requested.
- Anonymous users can generate a Free Kundli. Login must never be required for initial Kundli generation.
- Birth profiles are private customer data.
- Every profile or account mutation requires server-side authentication **and** ownership authorization.
- Never trust a browser-supplied `userId`. The acting user id comes only from the server session.
- Scope ownership in the query (`where: { id, userId }`) rather than comparing after fetching, so an unowned id resolves to "not found".
- Validate every return URL before use; only same-origin, path-absolute destinations are allowed. Prevent open redirects.
- Account routes are `noindex`, and are listed in `robots.ts` disallow.
- Authentication secrets and provider tokens are server-only and must never reach the client bundle.
- Reuse the existing `BirthDetailsForm` and the canonical birth schema. Never define a second birth form or restate validation rules.
- Provider-specific astrology structures must not leak into account UI.
- A Kundli result UUID is a capability to *view*, never a claim of ownership. Attaching a result to an account additionally requires a signed continuation.
- `AstrologyCalculation` rows are immutable and shared. Never mutate one to represent different birth data, and never re-point a `BirthProfile` that already has an owner.
- Server Actions are public endpoints: authenticate, validate with Zod, authorize, then execute.
- Proxy (formerly Middleware) is not an authorization boundary; enforce access in server components and server actions.
- Only one auth framework is installed. It is Better Auth. See `docs/authentication-decision.md`.
