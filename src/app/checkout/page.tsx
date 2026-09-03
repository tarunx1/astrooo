import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageContainer, Section } from "@/components/layout/primitives";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { CheckoutForm } from "@/components/shop/checkout-form";
import { requireUser } from "@/lib/auth/session";
import { findActiveCart, getCartView } from "@/lib/shop/cart";
import { syncAnonymousCartIntoAccount } from "@/lib/shop/cart-session";
import { quoteCart } from "@/lib/shop/orders";
import { formatMoneyMinor } from "@/lib/shop/catalog";
import { TAX_IS_CONFIGURED } from "@/lib/shop/pricing";
import { getRazorpayPublicKey, isReportCheckoutEnabled } from "@/lib/payments/config";
import { prisma } from "@/lib/db/prisma";

/** Checkout is private and must never be indexed. */
export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false, nocache: true },
};

export default async function CheckoutPage() {
  // Anonymous visitors are sent to sign in and returned here with their cart
  // intact; the cart is merged on the way back.
  const user = await requireUser("/checkout");

  await syncAnonymousCartIntoAccount();

  const cart = await findActiveCart({ userId: user.id });
  const view = cart ? await getCartView({ userId: user.id }) : null;

  if (!cart || !view || view.lines.length === 0) {
    return (
      <Section className="star-field">
        <PageContainer className="px-0">
          <h1 className="heading-xl">Checkout</h1>
          <div className="mt-8">
            <EmptyState message="Add something to your cart before checking out." title="Your cart is empty" />
            <div className="mt-5">
              <Button href="/shop" variant="primary">
                Browse the store
              </Button>
            </div>
          </div>
        </PageContainer>
      </Section>
    );
  }

  if (view.hasUnavailableLines) redirect("/cart");

  const quote = await quoteCart({ cartId: cart.id, userId: user.id });
  if (!quote.ok) redirect("/cart");

  const savedAddress = await prisma.address.findFirst({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: { line1: true, line2: true, city: true, state: true, postalCode: true, country: true, phone: true },
  });

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <h1 className="heading-xl">Checkout</h1>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <CheckoutForm
            checkoutEnabled={isReportCheckoutEnabled()}
            customer={{ name: user.name, email: user.email }}
            razorpayKeyId={getRazorpayPublicKey()}
            savedAddress={
              savedAddress
                ? {
                    fullName: user.name,
                    phone: savedAddress.phone ?? "",
                    addressLine1: savedAddress.line1,
                    addressLine2: savedAddress.line2 ?? "",
                    city: savedAddress.city,
                    region: savedAddress.state,
                    postalCode: savedAddress.postalCode,
                    country: savedAddress.country,
                  }
                : null
            }
            summary={{
              subtotalPaise: quote.totals.subtotalPaise,
              shippingPaise: quote.totals.shippingPaise,
              taxPaise: quote.totals.taxPaise,
              totalPaise: quote.totals.totalPaise,
              currency: quote.totals.currency,
            }}
          />

          <Card className="p-5 lg:sticky lg:top-[calc(var(--header-height)+16px)]">
            <h2 className="heading-md">Order summary</h2>

            <ul className="mt-4 grid gap-3">
              {view.lines.map((line) => (
                <li className="flex justify-between gap-3" key={line.itemId}>
                  <span className="min-w-0 body-sm text-foreground-secondary">
                    <span className="line-clamp-2">{line.title}</span>
                    <span className="text-foreground-muted"> x{line.quantity}</span>
                  </span>
                  <span className="shrink-0 body-sm text-foreground">
                    {formatMoneyMinor(line.lineTotalPaise, quote.totals.currency)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 grid gap-2.5 border-t border-border pt-4">
              <Row label="Subtotal" value={formatMoneyMinor(quote.totals.subtotalPaise, quote.totals.currency)} />
              <Row
                label="Shipping"
                value={quote.totals.shippingPaise === 0 ? "Free" : formatMoneyMinor(quote.totals.shippingPaise, quote.totals.currency)}
              />
              {!TAX_IS_CONFIGURED ? <Row label="Tax" value="Not applied" /> : null}
            </dl>

            <div className="mt-4 flex justify-between gap-4 border-t border-border pt-4">
              <span className="heading-sm">Total</span>
              <span className="heading-sm">{formatMoneyMinor(quote.totals.totalPaise, quote.totals.currency)}</span>
            </div>

            <p className="mt-4 caption text-foreground-muted">
              All prices are calculated on our server at the moment you pay.
            </p>
          </Card>
        </div>
      </PageContainer>
    </Section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="body-sm text-foreground-secondary">{label}</dt>
      <dd className="body-sm text-foreground">{value}</dd>
    </div>
  );
}
