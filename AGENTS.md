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

## Payments and Paid Reports

- Only one payment provider is wired for this phase: Razorpay in test mode. See `docs/payment-provider-decision.md`.
- Report checkout remains off unless `REPORT_CHECKOUT_ENABLED=true`.
- Never create a paid report order without an authenticated user, an owned birth profile and an immutable `AstrologyCalculation` snapshot.
- Use DB-backed `ReportDefinition` pricing as the source of truth. Never trust browser-supplied prices, report names or currency.
- Razorpay key secret and webhook secret are server-only. Only `RAZORPAY_KEY_ID` may reach the checkout client.
- Validate Razorpay Checkout signatures server-side before marking an order paid.
- Razorpay webhook routes must verify the raw request body and use idempotent event handling.
- Handle duplicate and out-of-order payment webhooks without creating duplicate fulfilment.
- Payment/provider response shapes must map into internal payment domain types before reaching account UI.
- Do not generate astrology report content, PDFs, shop checkout or admin fulfilment in the payment foundation phase.

## Physical Commerce, Cart and Orders

- Cart and browser values are never authoritative for price. Every total is recomputed from the database at read time and again at order creation.
- A CartItem stores a product reference and a quantity only. It never stores a price.
- `OrderItem` values are immutable purchase snapshots: title, SKU, variant and unit price are frozen at purchase and must never be rewritten when the catalogue changes.
- The shipping address must be snapshotted on the Order. Editing a saved Address later must not change a past order.
- Inventory must be concurrency-safe. Decrement with a guarded update requiring `quantity >= requested`; never read-then-write.
- Duplicate payment events must never decrement inventory twice. `Order.inventoryCommittedAt` is the idempotency guard.
- Physical checkout reuses the existing `PaymentProvider` and `RazorpayPaymentProvider`. Never add a second payment implementation or reimplement signature verification.
- One webhook endpoint serves both report and physical orders; it routes on the provider order id.
- An order is never marked paid on a browser callback alone. The webhook is authoritative.
- Cross-user cart, address, order and payment access is prohibited. Scope ownership inside the query.
- The cart is cleared (marked CONVERTED) only after a confirmed successful payment, never when checkout merely opens.
- A failed payment leaves the Order recoverable and preserves the failed Payment record. Never delete an order to let a customer retry.
- Money uses integer minor units everywhere. No floating point in any price, discount, shipping, tax or total.
- Coupons are validated server-side only and can never produce a negative total.
- `/cart`, `/checkout` and `/account/orders` are `noindex` and listed in `robots.ts` disallow.
- SHIPPED and DELIVERED are set by an operator, never automatically.
- Approved existing UI remains frozen unless a redesign is explicitly requested.

## Astrology Tools

- Astrology tools must use deterministic calculations. An LLM never determines a sign, planet, house, nakshatra, guna score, Panchang value, Sade Sati phase or numerology number.
- `BirthDetailsFields` is the single definition of birth inputs. Birth-based tools compose it; they never restate the fields.
- `LocationProvider` is the only way a place becomes coordinates and a timezone.
- Provider-specific values must normalize into domain types before reaching a component. VedAstro field names stop at the adapter.
- VedAstro `Time` parameters must be sent as an object. A string is silently defaulted to 01/01/2000 at a placeholder location and returns `Status: Pass`, so responses must be checked against the requested date and place.
- Calculator pages must not fabricate unsupported provider capabilities. A value the engine does not calculate is listed as unavailable, never estimated.
- Koota sub-scores are shown only where the engine supplies a number. They are never inferred from a good/bad classification and never back-filled to reach 36.
- Numerology rules are deterministic, Chaldean, and documented in `docs/numerology-methodology.md`. Master-number behaviour is explicit per number.
- Private calculation results remain `noindex`, and birth data never appears in a URL or query parameter.
- Public tools support SEO with one strong page each. Do not generate thin date or location permutation pages.
- Reuse the cached Kundli calculation for birth-based tools rather than issuing separate provider requests; the free tier allows 5 requests a minute.
- Approved existing UI remains visually frozen unless a redesign is explicitly requested.
