# Payment Provider Decision

## Decision

Ravish Astro uses the existing `PaymentProvider` abstraction with a Razorpay implementation for the paid-report payment foundation.

Only Razorpay is installed/wired for this phase. Checkout is disabled by default with `REPORT_CHECKOUT_ENABLED=false` so production cannot accept payment until report fulfilment is ready.

## Why Razorpay

- The current commerce surface is India-first and stores INR minor units (`paise`) throughout the schema.
- Razorpay supports server-created Orders and Standard Checkout, which fits the App Router model: the server creates a provider order, the browser opens Checkout with only public fields, and the server verifies the result.
- The API can be wrapped without introducing a second SDK type system into the domain layer.

## Integration Model

1. Authenticated customer selects a saved birth profile and report definition.
2. Server verifies ownership of the birth profile.
3. Server resolves or creates an immutable `AstrologyCalculation` for the current birth details and calculation config.
4. Server creates an internal `ReportOrder` with price/name/currency snapshots.
5. Server creates a Razorpay Order using the DB-backed price in minor units.
6. Checkout client receives only the public Razorpay key id, provider order id, amount, currency and customer display fields.
7. Checkout success payload is verified server-side with HMAC SHA256 before a payment/order can be marked paid.
8. Razorpay webhooks are verified against the raw request body and processed idempotently.

## Official Razorpay Assumptions

- Orders are created with `POST /v1/orders`; `amount` is in currency subunits, `currency` is an ISO code and `receipt` is an internal reference.
- Standard Checkout returns `razorpay_payment_id`, `razorpay_order_id` and `razorpay_signature` after payment success.
- The Checkout signature is verified server-side using `hmac_sha256(order_id + "|" + razorpay_payment_id, key_secret)`.
- Webhook signatures use the `X-Razorpay-Signature` header and HMAC SHA256 over the raw webhook request body with the configured webhook secret.
- Razorpay webhooks can be duplicated and can arrive out of order; processing must be idempotent and not depend on event order.

References:

- https://razorpay.com/docs/api/orders/create/
- https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
- https://razorpay.com/docs/webhooks/validate-test/
- https://razorpay.com/docs/webhooks/best-practices/

## Session and Authorization

Payments are tied to the Better Auth server session already documented in `docs/authentication-decision.md`.

The browser never sends or controls `userId`. Protected report actions derive the acting user from the server session, then scope reads by both `id` and `userId`.

## Security Assumptions

- `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are server-only.
- `RAZORPAY_KEY_ID` is the only Razorpay value exposed to the browser.
- Account and checkout pages are `noindex`.
- Report order pricing comes from `ReportDefinition`, not from form fields.
- A successful browser callback is not enough to fulfil anything; the server verifies the signature and fetches payment status.
- Webhooks are accepted only after signature verification and duplicate event detection.

## Future Extensibility

The provider boundary can later support refunds, other order types, subscriptions or another payment provider without leaking Razorpay types into account UI.

Report fulfilment, PDF generation, admin review and paid content delivery are explicitly out of scope for this phase.
