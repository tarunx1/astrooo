import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, Section } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CartLineItem } from "@/components/shop/cart-line-item";
import { EMPTY_CART, getCartView } from "@/lib/shop/cart";
import { resolveCartOwnerForRead, syncAnonymousCartIntoAccount } from "@/lib/shop/cart-session";
import { formatMoneyMinor } from "@/lib/shop/catalog";
import { SHIPPING_POLICY, TAX_IS_CONFIGURED } from "@/lib/shop/pricing";

/** A cart is personal to its holder and must never be indexed. */
export const metadata: Metadata = {
  title: "Your Cart",
  robots: { index: false, follow: false, nocache: true },
};

export default async function CartPage() {
  // A visitor returning from sign-in brings their anonymous cart with them.
  await syncAnonymousCartIntoAccount();

  const owner = await resolveCartOwnerForRead();
  const cart = owner ? await getCartView(owner) : EMPTY_CART;

  const shippingDue = cart.subtotalPaise > 0 && cart.subtotalPaise < SHIPPING_POLICY.freeAboveSubtotalPaise;
  const remainingForFree = SHIPPING_POLICY.freeAboveSubtotalPaise - cart.subtotalPaise;

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <h1 className="heading-xl">Your Cart</h1>

        {cart.lines.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              message="Browse certified gemstones, Rudraksha, crystals and more."
              title="Your cart is empty"
            />
            <div className="mt-5">
              <Button href="/shop" variant="primary">
                Continue shopping
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <div className="grid gap-3">
              <p aria-live="polite" className="caption text-foreground-muted">
                {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"} in your cart
              </p>
              {cart.lines.map((line) => (
                <CartLineItem currency={cart.currency} key={line.itemId} line={line} />
              ))}
            </div>

            <Card className="p-5 lg:sticky lg:top-[calc(var(--header-height)+16px)]">
              <h2 className="heading-md">Order summary</h2>

              <dl className="mt-4 grid gap-2.5">
                <div className="flex justify-between gap-4">
                  <dt className="body-sm text-foreground-secondary">Subtotal</dt>
                  <dd className="body-sm text-foreground">{formatMoneyMinor(cart.subtotalPaise, cart.currency)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="body-sm text-foreground-secondary">Shipping</dt>
                  <dd className="body-sm text-foreground">
                    {shippingDue ? formatMoneyMinor(SHIPPING_POLICY.flatRatePaise, cart.currency) : "Free"}
                  </dd>
                </div>
                {!TAX_IS_CONFIGURED ? (
                  <div className="flex justify-between gap-4">
                    <dt className="body-sm text-foreground-secondary">Tax</dt>
                    <dd className="body-sm text-foreground-muted">Calculated at checkout</dd>
                  </div>
                ) : null}
              </dl>

              {shippingDue ? (
                <p className="mt-3 caption text-foreground-muted">
                  Add {formatMoneyMinor(remainingForFree, cart.currency)} more for free shipping.
                </p>
              ) : null}

              <div className="mt-4 flex justify-between gap-4 border-t border-border pt-4">
                <span className="heading-sm">Total</span>
                <span className="heading-sm">
                  {formatMoneyMinor(cart.subtotalPaise + (shippingDue ? SHIPPING_POLICY.flatRatePaise : 0), cart.currency)}
                </span>
              </div>

              {cart.hasUnavailableLines ? (
                <p className="mt-4 caption text-danger" role="alert">
                  Some items need attention before you can check out.
                </p>
              ) : null}

              <Button
                className="mt-5 w-full"
                href={cart.hasUnavailableLines ? "/cart" : "/checkout"}
                variant="premium"
              >
                {cart.hasUnavailableLines ? "Review your cart" : "Proceed to checkout"}
              </Button>

              <Link
                className="mt-3 block text-center caption text-foreground-muted underline-offset-4 hover:text-foreground hover:underline"
                href="/shop"
                prefetch={false}
              >
                Continue shopping
              </Link>
            </Card>
          </div>
        )}
      </PageContainer>
    </Section>
  );
}
