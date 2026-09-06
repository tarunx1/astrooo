"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { placeOrderAction, verifyOrderPaymentAction } from "@/app/checkout/actions";
import { INITIAL_CHECKOUT_STATE, INITIAL_VERIFY_STATE } from "@/lib/shop/action-state";
import { formatMoneyMinor } from "@/lib/shop/pricing";
import { loadRazorpayCheckout } from "@/lib/payments/razorpay-checkout";
import { SmoothInput } from "@/components/ui/smooth-input";

/**
 * Checkout form.
 *
 * The browser collects an address and an optional coupon code. It never sends a
 * price: the server recomputes every figure from the database and returns the
 * provider order to open. Razorpay receives only the public key id and the
 * provider order id.
 */

type Saved = { fullName: string; phone: string; addressLine1: string; addressLine2: string; city: string; region: string; postalCode: string; country: string } | null;

export function CheckoutForm({
  savedAddress,
  customer,
  razorpayKeyId,
  checkoutEnabled,
  summary,
}: {
  savedAddress: Saved;
  customer: { name: string; email: string };
  razorpayKeyId: string | null;
  checkoutEnabled: boolean;
  summary: { subtotalPaise: number; shippingPaise: number; taxPaise: number; totalPaise: number; currency: string };
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(placeOrderAction, INITIAL_CHECKOUT_STATE);
  const [verifyState, verifyAction] = useActionState(verifyOrderPaymentAction, INITIAL_VERIFY_STATE);
  const [scriptReady, setScriptReady] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadRazorpayCheckout()
      .then(() => active && setScriptReady(true))
      .catch(() => active && setPaymentError("The payment window could not be loaded. Please try again."));
    return () => {
      active = false;
    };
  }, []);

  // Once the server has created the order, open the provider's checkout.
  useEffect(() => {
    if (!state.order || !razorpayKeyId || !scriptReady || !window.Razorpay) return;

    const order = state.order;
    const checkout = new window.Razorpay({
      key: razorpayKeyId,
      order_id: order.providerOrderId,
      amount: order.amountMinor,
      currency: order.currency,
      name: "Ravish Astro",
      description: `Order ${order.orderNumber}`,
      prefill: { name: customer.name, email: customer.email, contact: savedAddress?.phone ?? "" },
      handler: (response) => {
        const data = new FormData();
        data.set("orderId", order.orderId);
        data.set("providerOrderId", response.razorpay_order_id);
        data.set("providerPaymentId", response.razorpay_payment_id);
        data.set("signature", response.razorpay_signature);
        verifyAction(data);
      },
      modal: {
        ondismiss: () =>
          setPaymentError("Payment was not completed. Your order is saved — you can try again from your orders."),
      },
    });

    checkout.open();
  }, [state.order, razorpayKeyId, scriptReady, customer, savedAddress, verifyAction]);

  useEffect(() => {
    if (verifyState.verified && verifyState.orderId) {
      router.replace(`/account/orders/${verifyState.orderId}`);
    }
  }, [verifyState, router]);

  const fieldError = (field: string) => state.fieldErrors[field]?.[0];

  return (
    <form action={formAction} className="grid gap-6" noValidate>
      <Card className="p-5 sm:p-6">
        <h2 className="heading-md">Shipping address</h2>

        <div className="mt-4 grid gap-4">
          <Field error={fieldError("fullName")} label="Full name" name="fullName">
            <SmoothInput
              autoComplete="name"
              className={inputClass}
              defaultValue={savedAddress?.fullName ?? customer.name}
              id="fullName"
              name="fullName"
              required
            />
          </Field>

          <Field error={fieldError("phone")} label="Phone" name="phone">
            <SmoothInput
              autoComplete="tel"
              className={inputClass}
              defaultValue={savedAddress?.phone ?? ""}
              id="phone"
              inputMode="tel"
              name="phone"
              placeholder="10-digit mobile number"
              required
            />
          </Field>

          <Field error={fieldError("addressLine1")} label="Address" name="addressLine1">
            <SmoothInput
              autoComplete="address-line1"
              className={inputClass}
              defaultValue={savedAddress?.addressLine1 ?? ""}
              id="addressLine1"
              name="addressLine1"
              placeholder="House number and street"
              required
            />
          </Field>

          <Field error={fieldError("addressLine2")} label="Apartment, landmark (optional)" name="addressLine2">
            <SmoothInput
              autoComplete="address-line2"
              className={inputClass}
              defaultValue={savedAddress?.addressLine2 ?? ""}
              id="addressLine2"
              name="addressLine2"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field error={fieldError("city")} label="City" name="city">
              <SmoothInput
                autoComplete="address-level2"
                className={inputClass}
                defaultValue={savedAddress?.city ?? ""}
                id="city"
                name="city"
                required
              />
            </Field>
            <Field error={fieldError("region")} label="State" name="region">
              <SmoothInput
                autoComplete="address-level1"
                className={inputClass}
                defaultValue={savedAddress?.region ?? ""}
                id="region"
                name="region"
                required
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field error={fieldError("postalCode")} label="PIN code" name="postalCode">
              <SmoothInput
                autoComplete="postal-code"
                className={inputClass}
                defaultValue={savedAddress?.postalCode ?? ""}
                id="postalCode"
                inputMode="numeric"
                name="postalCode"
                required
              />
            </Field>
            <Field error={fieldError("country")} label="Country" name="country">
              <select className={inputClass} defaultValue={savedAddress?.country ?? "IN"} id="country" name="country">
                <option value="IN">India</option>
              </select>
            </Field>
          </div>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="heading-md">Coupon</h2>
        <p className="mt-1.5 body-sm text-foreground-secondary">
          Have a code? Enter it here — the discount is applied by our server when the order is placed.
        </p>
        <SmoothInput
          aria-label="Coupon code"
          className={`${inputClass} mt-3 uppercase`}
          name="couponCode"
          placeholder="Coupon code"
        />
      </Card>

      <div aria-live="polite">
        {state.error ? (
          <p className="rounded-md border border-danger/50 bg-background p-4 body-sm text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        {verifyState.error ? (
          <p className="rounded-md border border-danger/50 bg-background p-4 body-sm text-danger" role="alert">
            {verifyState.error}
          </p>
        ) : null}
        {paymentError ? (
          <p className="rounded-md border border-border bg-surface p-4 body-sm text-foreground-secondary" role="status">
            {paymentError}
          </p>
        ) : null}
      </div>

      {!checkoutEnabled ? (
        <p className="rounded-md border border-border bg-surface p-4 body-sm text-foreground-secondary" role="status">
          Store checkout is currently disabled on this environment.
        </p>
      ) : null}

      <button
        className="inline-flex min-h-14 w-full items-center justify-center rounded-md bg-premium px-7 py-4 text-base font-semibold text-background shadow-[var(--shadow-md)] transition hover:opacity-95 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
        disabled={pending || !checkoutEnabled || !razorpayKeyId}
        type="submit"
      >
        {pending ? "Preparing your order..." : `Pay ${formatMoneyMinor(summary.totalPaise, summary.currency)}`}
      </button>
    </form>
  );
}

const inputClass =
  "min-h-11 w-full rounded-md border border-border bg-background px-3.5 py-2.5 text-sm text-foreground transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan";

function Field({
  children,
  error,
  label,
  name,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
  name: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="caption text-foreground-secondary" htmlFor={name}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="caption text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
