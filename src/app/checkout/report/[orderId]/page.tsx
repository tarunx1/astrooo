import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountLayout, AccountSection } from "@/components/account/account-shell";
import { ReportCheckoutClient } from "@/components/reports/report-checkout-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { PaymentUnavailableError, PaymentValidationError } from "@/lib/payments/errors";
import { assertCheckoutPossible, getOwnedCheckoutOrder } from "@/lib/reports/orders";
import { formatMoneyMinor } from "@/lib/reports/catalog";

export const metadata: Metadata = {
  title: "Report Checkout",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

type Params = Promise<{ orderId: string }>;

export default async function ReportCheckoutPage({ params }: { params: Params }) {
  const user = await requireUser();
  const { orderId } = await params;
  const order = await getOwnedCheckoutOrder(user.id, orderId);
  if (!order) notFound();

  let checkoutError: string | null = null;
  try {
    assertCheckoutPossible(order);
  } catch (error) {
    if (error instanceof PaymentUnavailableError || error instanceof PaymentValidationError) {
      checkoutError = error.message;
    } else {
      throw error;
    }
  }

  return (
    <AccountLayout currentPath="/account/reports" description="Complete payment for your selected report." title="Checkout">
      <AccountSection title={order.reportName} description={order.profileName}>
        <Card className="grid gap-5 p-5" variant="commerce">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="caption text-foreground-muted">Amount</p>
              <p className="heading-md">{formatMoneyMinor(order.amountMinor, order.currency)}</p>
            </div>
            <Button href={`/reports/${order.reportSlug}`} size="sm" variant="ghost">
              Report details
            </Button>
          </div>

          {order.status === "PAID" ? (
            <div className="grid gap-3">
              <p className="body-sm text-foreground-secondary">This report order is already marked paid.</p>
              <Button href="/account/reports" variant="secondary">
                Back to reports
              </Button>
            </div>
          ) : checkoutError ? (
            <div className="grid gap-3">
              <p className="rounded-md border border-border bg-background p-3 body-sm text-foreground-secondary" role="status">
                {checkoutError}
              </p>
              <Button href="/reports" variant="secondary">
                Browse reports
              </Button>
            </div>
          ) : (
            <ReportCheckoutClient order={order} />
          )}
        </Card>
      </AccountSection>
    </AccountLayout>
  );
}
