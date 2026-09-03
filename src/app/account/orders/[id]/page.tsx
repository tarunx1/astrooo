import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AccountLayout, AccountSection } from "@/components/account/account-shell";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getOwnedOrder } from "@/lib/shop/orders";
import { formatMoneyMinor } from "@/lib/shop/catalog";
import { formatAddressSnapshot } from "@/lib/shop/address";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from "@/lib/shop/order-status";

export const metadata: Metadata = {
  title: "Order",
};

type VariantSnapshot = { title?: string; sku?: string };

export default async function AccountOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/account/orders/${id}`);

  // Ownership is enforced inside the query, so another user's order id resolves
  // to not found rather than a message confirming it exists.
  const order = await getOwnedOrder(user.id, id);
  if (!order) notFound();

  const addressLines = formatAddressSnapshot(order.shippingAddress);
  const latestPayment = order.payments[0] ?? null;

  return (
    <AccountLayout
      currentPath="/account/orders"
      description={`Placed ${order.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`}
      title={order.orderNumber}
    >
      <AccountSection description="What you ordered, exactly as it was at purchase." title="Items">
        <div className="grid gap-3">
          <span
            className={`w-fit rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ORDER_STATUS_TONE[order.status]}`}
          >
            {ORDER_STATUS_LABELS[order.status]}
          </span>

          <ul className="grid gap-3">
            {order.items.map((item) => {
              const variant = (item.variantSnapshot ?? null) as VariantSnapshot | null;
              return (
                <li key={item.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="heading-sm">{item.title}</p>
                        {variant?.title ? <p className="mt-0.5 caption text-foreground-muted">{variant.title}</p> : null}
                        {item.skuSnapshot ? (
                          <p className="mt-0.5 caption text-foreground-muted">SKU {item.skuSnapshot}</p>
                        ) : null}
                        <p className="mt-1 body-sm text-foreground-secondary">
                          {formatMoneyMinor(item.unitPricePaise, order.currency)} x {item.quantity}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-foreground">
                        {formatMoneyMinor(item.totalPaise, order.currency)}
                      </p>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      </AccountSection>

      {order.carrierName || order.trackingNumber || order.shippedAt ? (
        <AccountSection description="Provided by our team when your order was dispatched." title="Delivery">
          <Card className="grid gap-2 p-5">
            {order.carrierName ? <Row label="Carrier" value={order.carrierName} /> : null}
            {order.trackingNumber ? <Row label="Tracking number" value={order.trackingNumber} /> : null}
            {order.shippedAt ? (
              <Row label="Dispatched" value={order.shippedAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} />
            ) : null}
            {order.deliveredAt ? (
              <Row label="Delivered" value={order.deliveredAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} />
            ) : null}

            {order.trackingUrl ? (
              <a
                className="mt-2 inline-flex min-h-11 w-fit items-center justify-center rounded-md border border-border-strong bg-surface px-5 py-3 text-sm font-semibold transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                href={order.trackingUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Track this parcel
              </a>
            ) : null}

            <p className="mt-2 caption text-foreground-muted">
              Tracking details are entered by our team and are not verified with the carrier automatically.
            </p>
          </Card>
        </AccountSection>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <AccountSection description="Where this order was sent." title="Shipping address">
          <Card className="p-5">
            {addressLines.length > 0 ? (
              <address className="grid gap-1 not-italic body-sm text-foreground-secondary">
                {addressLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </address>
            ) : (
              <p className="body-sm text-foreground-muted">No address was recorded for this order.</p>
            )}
            <p className="mt-3 caption text-foreground-muted">
              This is the address used at purchase. Editing a saved address later does not change it.
            </p>
          </Card>
        </AccountSection>

        <AccountSection description="What you paid." title="Payment">
          <Card className="p-5">
            <dl className="grid gap-2.5">
              <Row label="Subtotal" value={formatMoneyMinor(order.subtotalPaise, order.currency)} />
              {order.discountPaise > 0 ? (
                <Row
                  label={order.couponCodeSnapshot ? `Discount (${order.couponCodeSnapshot})` : "Discount"}
                  value={`− ${formatMoneyMinor(order.discountPaise, order.currency)}`}
                />
              ) : null}
              <Row
                label="Shipping"
                value={order.shippingPaise === 0 ? "Free" : formatMoneyMinor(order.shippingPaise, order.currency)}
              />
              {order.taxPaise > 0 ? <Row label="Tax" value={formatMoneyMinor(order.taxPaise, order.currency)} /> : null}
            </dl>

            <div className="mt-4 flex justify-between gap-4 border-t border-border pt-4">
              <span className="heading-sm">Total</span>
              <span className="heading-sm">{formatMoneyMinor(order.totalPaise, order.currency)}</span>
            </div>

            <p className="mt-4 caption text-foreground-muted">
              {latestPayment
                ? `Payment ${latestPayment.status.toLowerCase()}${
                    latestPayment.capturedAt
                      ? ` on ${latestPayment.capturedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                      : ""
                  }.`
                : "No payment has been recorded for this order yet."}
            </p>

            {order.status === "PENDING_PAYMENT" ? (
              <Link
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                href="/checkout"
                prefetch={false}
              >
                Complete payment
              </Link>
            ) : null}
          </Card>
        </AccountSection>
      </div>
    </AccountLayout>
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
