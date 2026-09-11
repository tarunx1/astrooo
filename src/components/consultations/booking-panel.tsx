"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConsultationMode } from "@prisma/client";
import { CalendarDays, CreditCard, Loader2, MessageSquare, Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoneyMinor } from "@/lib/shop/pricing";
import { loadRazorpayCheckout } from "@/lib/payments/razorpay-checkout";
import {
  listSlotsAction,
  startBookingAction,
  verifyBookingPaymentAction,
  type SlotOption,
} from "@/app/consultations/actions";
import type { DirectoryPandit } from "@/lib/consultations/directory";

/**
 * The booking panel.
 *
 * Interactive, so it is a client component - but only this panel is. The
 * profile around it stays server-rendered so the page remains indexable and
 * fast; making the whole page client-side to accommodate a calendar would trade
 * the SEO value of the profile for nothing.
 *
 * Price shown here is the server's own figure, returned from the checkout
 * action. The panel estimates nothing: what it displays before checkout is
 * derived from the same stored rate the server will charge, and the
 * authoritative amount comes back with the payment order.
 */
const MODE_META = {
  [ConsultationMode.CHAT]: { label: "Chat", icon: MessageSquare },
  [ConsultationMode.VOICE_CALL]: { label: "Voice call", icon: Phone },
  [ConsultationMode.VIDEO_CALL]: { label: "Video call", icon: Video },
} as const;

const DURATIONS = [15, 30, 45, 60] as const;

/** The next 14 local dates, as `YYYY-MM-DD`. */
function upcomingDates(count = 14): string[] {
  const dates: string[] = [];
  const cursor = new Date();

  for (let index = 0; index < count; index += 1) {
    dates.push(
      new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(cursor),
    );
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function BookingPanel({
  pandit,
  viewer,
}: {
  pandit: DirectoryPandit;
  viewer: { signedIn: boolean; name: string; email: string } | null;
}) {
  const router = useRouter();
  const dates = useMemo(() => upcomingDates(), []);

  const offeredModes = useMemo(
    () => pandit.services.map((service) => service.mode),
    [pandit.services],
  );

  const [mode, setMode] = useState<ConsultationMode | null>(offeredModes[0] ?? null);
  const [duration, setDuration] = useState<number>(30);
  const [date, setDate] = useState<string>(dates[0]);
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paying, startPaying] = useTransition();

  // Bumped to force a re-fetch after a booking attempt loses a race, so the
  // customer is not left looking at a time that has just been taken.
  const [reloadToken, setReloadToken] = useState(0);

  const service = pandit.services.find((item) => item.mode === mode) ?? null;

  // A fixed-session rate carries its own length, so the duration choice does
  // not apply to it.
  const fixedSession = service?.rateType === "FIXED_SESSION";
  const effectiveDuration = fixedSession ? (service?.sessionMinutes ?? duration) : duration;

  /**
   * What this will cost, derived from the same stored rate the server prices
   * from. Shown as an indication; the authoritative amount comes back with the
   * payment order and is what the customer is actually charged.
   */
  const estimateMinor = service
    ? service.rateType === "PER_MINUTE"
      ? service.ratePaise * effectiveDuration
      : service.ratePaise
    : null;

  /**
   * Identifies the availability request currently on screen.
   *
   * Loading is derived by comparing this with the key of the results we hold,
   * rather than by setting a flag at the top of the effect - a synchronous
   * setState in an effect body causes a second render pass before the fetch has
   * even started.
   */
  const requestKey = `${pandit.slug}|${date}|${mode}|${effectiveDuration}|${reloadToken}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loadingSlots = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!mode) return;

      const result = await listSlotsAction({
        slug: pandit.slug,
        date,
        mode,
        durationMinutes: effectiveDuration,
      });

      // A slower earlier request must not overwrite a newer one's results.
      if (cancelled) return;

      if (!result.ok) {
        setSlots([]);
        setSlotError(result.message);
      } else {
        setSlots(result.slots);
        setTimezone(result.timezone);
        setSlotError(null);
      }

      setSelected(null);
      setLoadedKey(requestKey);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [requestKey, pandit.slug, date, mode, effectiveDuration]);

  async function book() {
    if (!mode || !selected) return;

    setError(null);
    setNotice(null);

    const started = await startBookingAction({
      slug: pandit.slug,
      mode,
      startISO: selected,
      durationMinutes: effectiveDuration,
    });

    if (!started.ok) {
      if (started.needsAuth) {
        router.push(`/sign-in?returnTo=${encodeURIComponent(`/consultations/${pandit.slug}`)}`);
        return;
      }
      setError(started.message);
      // The slot may have gone while they were deciding; re-fetch so they are
      // not staring at a time that no longer exists.
      setReloadToken((token) => token + 1);
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
      description: `${MODE_META[mode].label} with ${summary.panditName}`,
      order_id: summary.providerOrderId,
      prefill: { name: viewer?.name ?? "", email: viewer?.email ?? "" },
      notes: { consultationId: summary.consultationId },
      handler(response) {
        startPaying(async () => {
          const verified = await verifyBookingPaymentAction(summary.consultationId, response);

          if (!verified.ok) {
            setError(verified.message);
            return;
          }

          router.push("/account/consultations");
          router.refresh();
        });
      },
      modal: {
        ondismiss() {
          setNotice(
            "Payment was not completed. Your slot is held for a short while if you want to try again.",
          );
        },
      },
    });

    checkout.open();
  }

  if (!mode || pandit.services.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6">
        <h2 className="heading-sm">Booking</h2>
        <p className="mt-2 body-sm text-foreground-secondary">
          This practitioner has not opened any consultation types yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h2 className="heading-sm">Book a consultation</h2>

      <fieldset className="mt-5">
        <legend className="mb-2 caption font-semibold uppercase tracking-wider text-foreground-muted">
          Consultation type
        </legend>
        <div className="flex flex-wrap gap-2">
          {pandit.services.map((item) => {
            const meta = MODE_META[item.mode];
            const Icon = meta.icon;
            const active = item.mode === mode;

            return (
              <button
                aria-pressed={active}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-md border px-3.5 body-sm font-medium transition",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-foreground-secondary hover:border-border-strong hover:text-foreground",
                )}
                key={item.mode}
                onClick={() => setMode(item.mode)}
                type="button"
              >
                <Icon aria-hidden="true" size={15} />
                {meta.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {!fixedSession ? (
        <fieldset className="mt-5">
          <legend className="mb-2 caption font-semibold uppercase tracking-wider text-foreground-muted">
            Duration
          </legend>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((minutes) => (
              <button
                aria-pressed={minutes === duration}
                className={cn(
                  "min-h-11 rounded-md border px-4 body-sm font-medium transition",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
                  minutes === duration
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-foreground-secondary hover:border-border-strong hover:text-foreground",
                )}
                key={minutes}
                onClick={() => setDuration(minutes)}
                type="button"
              >
                {minutes} min
              </button>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="mt-5 body-sm text-foreground-secondary">
          Fixed session of {service?.sessionMinutes} minutes.
        </p>
      )}

      <div className="mt-5">
        <label className="mb-2 block caption font-semibold uppercase tracking-wider text-foreground-muted" htmlFor="booking-date">
          Date
        </label>
        <select
          className="form-control min-h-11 w-full"
          id="booking-date"
          onChange={(event) => setDate(event.target.value)}
          value={date}
        >
          {dates.map((value) => (
            <option key={value} value={value}>
              {new Date(`${value}T12:00:00Z`).toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5">
        <p className="mb-2 caption font-semibold uppercase tracking-wider text-foreground-muted">
          Available times
          {timezone ? <span className="ml-1 font-normal normal-case tracking-normal">({timezone})</span> : null}
        </p>

        <div aria-busy={loadingSlots} aria-live="polite">
          {loadingSlots ? (
            <p className="flex items-center gap-2 body-sm text-foreground-muted">
              <Loader2 aria-hidden="true" className="animate-spin" size={15} />
              Checking availability
            </p>
          ) : slotError ? (
            <p className="body-sm text-foreground-muted">{slotError}</p>
          ) : slots.length === 0 ? (
            <p className="flex items-center gap-2 body-sm text-foreground-muted">
              <CalendarDays aria-hidden="true" size={15} />
              No times available on this date. Try another day.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <button
                  aria-pressed={selected === slot.startISO}
                  className={cn(
                    "min-h-10 rounded-md border px-3 body-sm font-medium tabular-nums transition",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
                    selected === slot.startISO
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-foreground-secondary hover:border-border-strong hover:text-foreground",
                  )}
                  key={slot.startISO}
                  onClick={() => setSelected(slot.startISO)}
                  type="button"
                >
                  {new Date(slot.startISO).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {estimateMinor !== null ? (
        <dl className="mt-6 grid gap-2 border-t border-border pt-5">
          <div className="flex items-center justify-between">
            <dt className="body-sm text-foreground-secondary">
              {MODE_META[mode].label} · {effectiveDuration} min
            </dt>
            <dd className="body-sm font-semibold text-foreground">
              {formatMoneyMinor(estimateMinor, "INR")}
            </dd>
          </div>
          <p className="caption text-foreground-muted">
            Confirmed at the practitioner&rsquo;s current rate when you pay.
          </p>
        </dl>
      ) : null}

      <div aria-live="polite" className="mt-4 grid gap-3">
        {error ? (
          <p className="rounded-md border border-danger/50 bg-background p-3 body-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-md border border-warning/50 bg-background p-3 body-sm text-warning" role="status">
            {notice}
          </p>
        ) : null}
      </div>

      <Button
        className="mt-4 w-full"
        disabled={!selected || paying || loadingSlots}
        onClick={book}
        type="button"
      >
        {paying ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" size={16} />
            Confirming
          </>
        ) : (
          <>
            <CreditCard aria-hidden="true" size={16} />
            {viewer?.signedIn ? "Continue to payment" : "Sign in to book"}
          </>
        )}
      </Button>

      <p className="mt-3 caption text-foreground-muted">
        Free cancellation up to 2 hours before the session.
      </p>
    </div>
  );
}
