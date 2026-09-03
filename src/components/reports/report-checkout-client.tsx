"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyReportPaymentAction } from "@/app/checkout/report/[orderId]/actions";
import type { CheckoutReportOrder } from "@/lib/reports/orders";
import { loadRazorpayCheckout } from "@/lib/payments/razorpay-checkout";


export function ReportCheckoutClient({ order }: { order: CheckoutReportOrder }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function openCheckout() {
    setError(null);

    try {
      await loadRazorpayCheckout();
    } catch {
      setError("Payment checkout could not be loaded. Please try again.");
      return;
    }

    if (!window.Razorpay || !order.keyId || !order.providerOrderId) {
      setError("Payment checkout is not configured.");
      return;
    }

    const checkout = new window.Razorpay({
      key: order.keyId,
      amount: order.amountMinor,
      currency: order.currency,
      name: "Ravish Astro",
      description: order.reportName,
      order_id: order.providerOrderId,
      prefill: { name: order.userName, email: order.userEmail },
      notes: { reportOrderId: order.id },
      handler(response) {
        startTransition(async () => {
          const result = await verifyReportPaymentAction(order.id, response);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          router.replace("/account/reports");
          router.refresh();
        });
      },
      modal: {
        ondismiss() {
          setError("Payment was not completed.");
        },
      },
    });

    checkout.open();
  }

  return (
    <div className="grid gap-4">
      {error ? (
        <p className="rounded-md border border-danger/50 bg-background p-3 body-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={pending} onClick={openCheckout} type="button">
        <CreditCard aria-hidden="true" size={17} />
        {pending ? "Verifying payment..." : "Pay securely"}
      </Button>
      <p className="caption text-foreground-muted">
        Payment status is confirmed server-side using Razorpay signature verification and webhook updates.
      </p>
    </div>
  );
}
