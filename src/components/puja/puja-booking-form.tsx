"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PujaMode } from "@prisma/client";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmoothInput } from "@/components/ui/smooth-input";
import { FormField } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";
import { formatMoneyMinor } from "@/lib/shop/pricing";
import { loadRazorpayCheckout } from "@/lib/payments/razorpay-checkout";
import { startPujaBookingAction, verifyPujaPaymentAction } from "@/app/puja/actions";

/**
 * The puja booking form.
 *
 * Collects the Sankalp - the family and intention details the ritual is
 * performed under - and hands it straight to the server. The panel keeps it in
 * local state only long enough to submit it, and the action never echoes it
 * back, because it is private customer data.
 */
const MODE_LABEL: Record<PujaMode, string> = {
  [PujaMode.ONLINE]: "Online, streamed to you",
  [PujaMode.IN_PERSON]: "At your home",
  [PujaMode.TEMPLE]: "At a temple on your behalf",
};

const inputClass = "form-control";

export function PujaBookingForm({
  slug,
  title,
  pricePaise,
  currency,
  modes,
  viewer,
}: {
  slug: string;
  title: string;
  pricePaise: number;
  currency: string;
  modes: readonly PujaMode[];
  viewer: { signedIn: boolean; name: string; email: string } | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<PujaMode>(modes[0] ?? PujaMode.ONLINE);
  const [error, setError] = useState<string | null>(null);
  const [pending, startPending] = useTransition();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);

    const sankalp = {
      fullName: String(form.get("fullName") ?? "").trim(),
      gotra: String(form.get("gotra") ?? "").trim() || null,
      familyMembers: String(form.get("familyMembers") ?? "")
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
      dateOfBirth: String(form.get("dateOfBirth") ?? "").trim() || null,
      birthPlace: String(form.get("birthPlace") ?? "").trim() || null,
      intention: String(form.get("intention") ?? "").trim() || null,
    };

    const requestedDate = String(form.get("requestedDate") ?? "").trim() || null;

    const started = await startPujaBookingAction({ slug, mode, requestedDate, sankalp });

    if (!started.ok) {
      if (started.needsAuth) {
        router.push(`/sign-in?returnTo=${encodeURIComponent(`/puja/${slug}`)}`);
        return;
      }
      setError(started.message);
      return;
    }

    const summary = started.summary;

    if (!summary.keyId) {
      setError("Payments are not configured on this site yet. Please try again later.");
      return;
    }

    try {
      await loadRazorpayCheckout();
    } catch {
      setError("The payment window could not be loaded. Please try again.");
      return;
    }

    if (!window.Razorpay) {
      setError("The payment window could not be loaded. Please try again.");
      return;
    }

    const checkout = new window.Razorpay({
      key: summary.keyId,
      amount: summary.amountMinor,
      currency: summary.currency,
      name: "Tarun Astro",
      description: summary.title,
      order_id: summary.providerOrderId,
      prefill: { name: viewer?.name ?? "", email: viewer?.email ?? "" },
      notes: { pujaBookingId: summary.bookingId },
      handler(response) {
        startPending(async () => {
          const verified = await verifyPujaPaymentAction(summary.bookingId, response);

          if (!verified.ok) {
            setError(verified.message);
            return;
          }

          router.push("/account/puja");
          router.refresh();
        });
      },
      modal: {
        ondismiss() {
          setError("Payment was not completed. Your booking has not been confirmed.");
        },
      },
    });

    checkout.open();
  }

  return (
    <form className="grid gap-5 rounded-lg border border-border bg-surface p-6" onSubmit={submit}>
      <div>
        <h2 className="heading-sm">Book this puja</h2>
        <p className="mt-1 body-sm text-foreground-secondary">
          {formatMoneyMinor(pricePaise, currency)} · {title}
        </p>
      </div>

      {modes.length > 1 ? (
        <fieldset>
          <legend className="mb-2 caption font-semibold uppercase tracking-wider text-foreground-muted">
            How it is performed
          </legend>
          <div className="grid gap-2">
            {modes.map((option) => (
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-md border px-3.5 py-2.5 body-sm transition",
                  mode === option
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-foreground-secondary hover:border-border-strong",
                )}
                key={option}
              >
                <input
                  checked={mode === option}
                  className="size-4 accent-[var(--primary)]"
                  name="mode"
                  onChange={() => setMode(option)}
                  type="radio"
                  value={option}
                />
                {MODE_LABEL[option]}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <FormField
        hint="We will confirm the exact time with you after booking."
        id="requestedDate"
        label="Preferred date"
      >
        <SmoothInput className={inputClass} id="requestedDate" name="requestedDate" type="date" />
      </FormField>

      <fieldset className="grid gap-4 border-t border-border pt-5">
        <legend className="caption font-semibold uppercase tracking-wider text-foreground-muted">
          Sankalp details
        </legend>
        <p className="body-sm text-foreground-secondary">
          The ritual is performed in your name. These details are shared only with the practitioner
          assigned to perform it.
        </p>

        <FormField id="fullName" label="Your full name">
          <SmoothInput
            className={inputClass}
            defaultValue={viewer?.name ?? ""}
            id="fullName"
            name="fullName"
            required
          />
        </FormField>

        <FormField hint="Optional. Leave blank if you do not know it." id="gotra" label="Gotra">
          <SmoothInput className={inputClass} id="gotra" name="gotra" />
        </FormField>

        <FormField
          hint="One name per line. Optional."
          id="familyMembers"
          label="Others to include"
        >
          <textarea className={inputClass} id="familyMembers" name="familyMembers" rows={3} />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="dateOfBirth" label="Date of birth (optional)">
            <SmoothInput className={inputClass} id="dateOfBirth" name="dateOfBirth" type="date" />
          </FormField>
          <FormField id="birthPlace" label="Place of birth (optional)">
            <SmoothInput className={inputClass} id="birthPlace" name="birthPlace" />
          </FormField>
        </div>

        <FormField
          hint="What would you like this puja performed for?"
          id="intention"
          label="Your intention (optional)"
        >
          <textarea className={inputClass} id="intention" name="intention" rows={3} />
        </FormField>
      </fieldset>

      <div aria-live="polite">
        {error ? (
          <p className="rounded-md border border-danger/50 bg-background p-3 body-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <Button disabled={pending} type="submit">
        {pending ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" size={16} />
            Confirming
          </>
        ) : (
          <>
            <CreditCard aria-hidden="true" size={16} />
            {viewer?.signedIn
              ? `Book for ${formatMoneyMinor(pricePaise, currency)}`
              : "Sign in to book"}
          </>
        )}
      </Button>

      <p className="inline-flex items-start gap-2 caption text-foreground-muted">
        <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={13} />
        A verified practitioner is assigned after booking, and we confirm the date with you before the
        ritual is performed.
      </p>
    </form>
  );
}
