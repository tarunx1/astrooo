import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminLayout, AdminSection, AdminStatusBadge } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { OrderTransitionControls, ShipmentForm } from "@/components/admin/order-controls";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { allowedNextStatuses } from "@/lib/admin/order-transitions";
import { formatMoneyMinor } from "@/lib/shop/pricing";
import { formatAddressSnapshot } from "@/lib/shop/address";
import { ORDER_STATUS_LABELS } from "@/lib/shop/order-status";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      subtotalPaise: true,
      discountPaise: true,
      shippingPaise: true,
      taxPaise: true,
      totalPaise: true,
      currency: true,
      couponCodeSnapshot: true,
      shippingAddress: true,
      carrierName: true,
      trackingNumber: true,
      trackingUrl: true,
      createdAt: true,
      paidAt: true,
      processingAt: true,
      shippedAt: true,
      deliveredAt: true,
      cancelledAt: true,
      inventoryCommittedAt: true,
      inventoryShortfall: true,
      user: { select: { name: true, email: true } },
      items: {
        select: {
          id: true,
          title: true,
          skuSnapshot: true,
          quantity: true,
          unitPricePaise: true,
          totalPaise: true,
        },
      },
      // Deliberately narrow: status and amount only. No provider identifiers,
      // no raw gateway response, no payment instrument detail.
      payments: {
        select: { id: true, status: true, amountPaise: true, currency: true, capturedAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) notFound();

  const addressLines = formatAddressSnapshot(order.shippingAddress);
  const nextStatuses = allowedNextStatuses(order.status);

  const timeline = [
    { label: "Placed", at: order.createdAt },
    { label: "Paid", at: order.paidAt },
    { label: "Processing", at: order.processingAt },
    { label: "Shipped", at: order.shippedAt },
    { label: "Delivered", at: order.deliveredAt },
    { label: "Cancelled", at: order.cancelledAt },
  ].filter((entry) => entry.at);

  return (
    <AdminLayout
      adminName={admin.name || admin.email}
      currentPath="/admin/orders"
      description={`${order.user.email} · placed ${order.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`}
      title={order.orderNumber}
    >
      <AdminSection title="Fulfilment">
        <Card className="grid gap-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <AdminStatusBadge label={ORDER_STATUS_LABELS[order.status]} tone="info" />
            {order.inventoryCommittedAt ? (
              <AdminStatusBadge label="Stock committed" tone="positive" />
            ) : (
              <AdminStatusBadge label="Stock not committed" tone="neutral" />
            )}
            {Array.isArray(order.inventoryShortfall) && order.inventoryShortfall.length > 0 ? (
              <AdminStatusBadge label="Stock shortfall — needs attention" tone="danger" />
            ) : null}
          </div>

          {nextStatuses.length > 0 ? (
            <OrderTransitionControls nextStatuses={[...nextStatuses]} orderId={order.id} />
          ) : (
            <p className="body-sm text-foreground-muted">
              No further fulfilment steps are available from this state.
            </p>
          )}

          <p className="caption text-foreground-muted">
            Payment status is set by verified payment processing and cannot be changed here.
          </p>
        </Card>
      </AdminSection>

      <AdminSection description="Entered manually. Nothing here is verified against a carrier." title="Shipment">
        <Card className="p-5">
          <ShipmentForm
            carrierName={order.carrierName}
            orderId={order.id}
            trackingNumber={order.trackingNumber}
            trackingUrl={order.trackingUrl}
          />
        </Card>
      </AdminSection>

      <div className="grid gap-8 lg:grid-cols-2">
        <AdminSection description="Frozen at purchase. Later catalogue edits never change these." title="Items">
          <ul className="grid gap-2">
            {order.items.map((item) => (
              <li key={item.id}>
                <Card className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="body-sm font-semibold text-foreground">{item.title}</p>
                    {item.skuSnapshot ? <p className="caption text-foreground-muted">SKU {item.skuSnapshot}</p> : null}
                    <p className="caption text-foreground-muted">
                      {formatMoneyMinor(item.unitPricePaise, order.currency)} x {item.quantity}
                    </p>
                  </div>
                  <p className="shrink-0 body-sm text-foreground">{formatMoneyMinor(item.totalPaise, order.currency)}</p>
                </Card>
              </li>
            ))}
          </ul>

          <Card className="mt-3 grid gap-2 p-4">
            <Row label="Subtotal" value={formatMoneyMinor(order.subtotalPaise, order.currency)} />
            {order.discountPaise > 0 ? (
              <Row
                label={order.couponCodeSnapshot ? `Discount (${order.couponCodeSnapshot})` : "Discount"}
                value={`− ${formatMoneyMinor(order.discountPaise, order.currency)}`}
              />
            ) : null}
            <Row label="Shipping" value={order.shippingPaise === 0 ? "Free" : formatMoneyMinor(order.shippingPaise, order.currency)} />
            {order.taxPaise > 0 ? <Row label="Tax" value={formatMoneyMinor(order.taxPaise, order.currency)} /> : null}
            <div className="mt-1 flex justify-between gap-3 border-t border-border pt-2">
              <span className="body-sm font-semibold text-foreground">Total</span>
              <span className="body-sm font-semibold text-foreground">{formatMoneyMinor(order.totalPaise, order.currency)}</span>
            </div>
          </Card>
        </AdminSection>

        <div className="grid gap-8">
          <AdminSection title="Shipping address">
            <Card className="p-5">
              {addressLines.length > 0 ? (
                <address className="grid gap-1 not-italic body-sm text-foreground-secondary">
                  {addressLines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </address>
              ) : (
                <p className="body-sm text-foreground-muted">No address recorded.</p>
              )}
            </Card>
          </AdminSection>

          <AdminSection description="Status and amount only." title="Payments">
            <Card className="grid gap-2 p-5">
              {order.payments.length === 0 ? (
                <p className="body-sm text-foreground-muted">No payment recorded.</p>
              ) : (
                order.payments.map((payment) => (
                  <div className="flex flex-wrap items-center justify-between gap-2" key={payment.id}>
                    <AdminStatusBadge
                      label={payment.status}
                      tone={payment.status === "CAPTURED" ? "positive" : payment.status === "FAILED" ? "danger" : "neutral"}
                    />
                    <span className="body-sm text-foreground">{formatMoneyMinor(payment.amountPaise, payment.currency)}</span>
                    <span className="caption text-foreground-muted">
                      {(payment.capturedAt ?? payment.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                ))
              )}
            </Card>
          </AdminSection>

          <AdminSection title="Timeline">
            <Card className="grid gap-2 p-5">
              {timeline.map((entry) => (
                <div className="flex justify-between gap-3" key={entry.label}>
                  <span className="body-sm text-foreground-muted">{entry.label}</span>
                  <span className="body-sm text-foreground">
                    {entry.at!.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
              ))}
            </Card>
          </AdminSection>
        </div>
      </div>
    </AdminLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="body-sm text-foreground-muted">{label}</span>
      <span className="body-sm text-foreground">{value}</span>
    </div>
  );
}
