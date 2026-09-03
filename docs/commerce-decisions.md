# Physical commerce decisions

Status: accepted — 3 September 2026
Scope: Phase 5 — cart, checkout, inventory and orders

## Inventory strategy

**Validate at checkout, decrement atomically after payment.**

Reservations with expiry were considered and rejected for this phase: they add a
reservation table, a sweeper and a failure mode of their own, for a catalogue
whose stock counts are currently in single digits.

The trade-off is stated plainly: between passing checkout validation and paying,
two buyers can both believe the last unit is theirs. That is resolved after
payment rather than before it.

- The decrement is a guarded update requiring `quantity >= requested`, so stock
  can never go negative and no oversell is written.
- A line that cannot be filled is recorded in `Order.inventoryShortfall` and
  logged. The order stays `PAID` — the customer has been charged and that fact is
  not hidden — and the shortfall is resolved by refund or restock manually.
- `Order.inventoryCommittedAt` is claimed with a guarded update inside the
  commit transaction. Only the first caller sees `count === 1`, so duplicate or
  concurrent payment events decrement exactly once. This is covered by a test
  that fires four concurrent commits and asserts exactly one wins.

When stock volumes grow, the seam to change is `commitInventoryForOrder`; nothing
else needs to move.

## Tax

**Not configured.** `TAX_IS_CONFIGURED` is `false` and `ZeroTaxCalculator`
returns zero. Checkout displays "Not applied" rather than an invented figure.

This is deliberately not a claim of GST compliance. The `TaxCalculator`
abstraction exists so a real implementation can be dropped in without touching
checkout, and it must be implemented before the store takes live orders.

## Shipping

Flat rate of ₹99, free above ₹1,500, both in `SHIPPING_POLICY`. No carrier
integration. `ShippingCalculator` is the seam for zone or weight-based rates.

## Anonymous cart

A 256-bit opaque token in an HttpOnly, SameSite=Lax cookie. Only the SHA-256
digest is stored in `Cart.sessionId`, so a database leak does not yield a working
cart cookie. No price, product or quantity is ever held browser-side.

On sign-in the anonymous cart is merged into the user's cart: the same product
and variant combine, different variants stay separate, and every quantity is
clamped to both the line maximum and available stock. The anonymous cart is
marked `CONVERTED` rather than deleted, so the merge is traceable and safe to
repeat.

## Payment reuse

The existing `PaymentProvider` and `RazorpayPaymentProvider` are reused
unchanged. `Payment` already carried both `orderId` and `reportOrderId`, so the
generic reference needed no new abstraction.

One webhook endpoint serves both purchase kinds and routes on the provider order
id: a physical order is looked up first, and only if none matches is the report
path taken. Raw-body verification, event deduplication, and amount, currency and
provider-order checks are shared by both.

The browser callback is a convenience only. It verifies the signature server-side
and re-fetches the payment from the provider rather than trusting the browser;
the webhook remains authoritative.
