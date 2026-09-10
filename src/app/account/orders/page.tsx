import type { Metadata } from "next";
import Link from "next/link";
import { AccountLayout, AccountSection } from "@/components/account/account-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/session";
import { listAccountOrders } from "@/lib/shop/orders";
import { formatMoneyMinor } from "@/lib/shop/catalog";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from "@/lib/shop/order-status";

export const metadata: Metadata = {
  title: "My Orders",
};

export default async function AccountOrdersPage() {
  const user = await requireUser("/account/orders");
  const orders = await listAccountOrders(user.id);

  return (
    <AccountLayout
      currentPath="/account/orders"
      description="Gemstones, Rudraksha and other store items you have ordered."
      title="Orders"
    >
      <AccountSection
        action={
          <Button href="/shop" size="sm" variant="secondary">
            Browse the store
          </Button>
        }
        description={orders.length === 1 ? "1 order" : `${orders.length} orders`}
        title="Your orders"
      >
        {orders.length === 0 ? (
          <EmptyState message="Your store orders will appear here." title="No orders yet" />
        ) : (
          <ul className="grid gap-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Card className="p-5" variant="glass">
                  <div className="flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="heading-sm">{order.orderNumber}</h3>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ORDER_STATUS_TONE[order.status]}`}
                        >
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                      </div>
                      <p className="mt-2 body-sm line-clamp-2 text-foreground-secondary">{order.itemsSummary}</p>
                      <p className="mt-1 caption text-foreground-muted">
                        {order.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {" · "}
                        {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                        {" · "}
                        {formatMoneyMinor(order.totalPaise, order.currency)}
                      </p>
                    </div>

                    <Link
                      className="min-h-9 shrink-0 rounded-md border border-border-strong bg-surface px-3 py-2 text-xs font-semibold transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                      href={`/account/orders/${order.id}`}
                      prefetch={false}
                    >
                      View order
                    </Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </AccountSection>
    </AccountLayout>
  );
}
