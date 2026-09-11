"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConsultationMode, ConsultationStatus } from "@prisma/client";
import { MessageSquare, Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoneyMinor } from "@/lib/shop/pricing";
import {
  CONSULTATION_STATUS_LABEL,
  CONSULTATION_STATUS_TONE,
  cancellationDecision,
  joinDecision,
} from "@/lib/consultations/status";
import { cancelBookingAction } from "@/app/consultations/actions";
import type { BookingView } from "@/lib/consultations/bookings";

/**
 * A booking row.
 *
 * Whether cancelling or joining is offered comes from the same policy functions
 * the server uses, so the button a customer sees is never one the action would
 * then refuse.
 */
const MODE_ICON = {
  [ConsultationMode.CHAT]: MessageSquare,
  [ConsultationMode.VOICE_CALL]: Phone,
  [ConsultationMode.VIDEO_CALL]: Video,
} as const;

const TONE_CLASS = {
  positive: "border-success/40 text-success",
  warning: "border-warning/40 text-warning",
  danger: "border-danger/40 text-danger",
  info: "border-accent-cyan/40 text-accent-cyan",
  neutral: "border-border text-foreground-muted",
} as const;

export function BookingList({
  bookings,
  side,
}: {
  bookings: readonly BookingView[];
  side: "customer" | "pandit";
}) {
  return (
    <ul className="grid gap-3">
      {bookings.map((booking) => (
        <li key={booking.id}>
          <BookingRow booking={booking} side={side} />
        </li>
      ))}
    </ul>
  );
}

function BookingRow({ booking, side }: { booking: BookingView; side: "customer" | "pandit" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const Icon = MODE_ICON[booking.mode as ConsultationMode] ?? MessageSquare;
  const tone = CONSULTATION_STATUS_TONE[booking.status];

  const cancel = cancellationDecision({
    status: booking.status,
    scheduledStart: booking.scheduledStart,
  });

  const join = joinDecision({ status: booking.status, scheduledStart: booking.scheduledStart });

  function onCancel() {
    if (!window.confirm("Cancel this consultation?")) return;

    startTransition(async () => {
      const result = await cancelBookingAction(booking.id);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage(
        result.refundable
          ? "Cancelled. A refund is due under the cancellation policy and will be processed by our team."
          : "Cancelled.",
      );
      router.refresh();
    });
  }

  return (
    <article className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="heading-sm text-foreground">
              {booking.counterpartSlug ? (
                <Link className="underline-offset-2 hover:underline" href={`/consultations/${booking.counterpartSlug}`}>
                  {booking.counterpartName}
                </Link>
              ) : (
                booking.counterpartName
              )}
            </h3>
            <span
              className={cn(
                "inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                TONE_CLASS[tone],
              )}
            >
              {CONSULTATION_STATUS_LABEL[booking.status]}
            </span>
          </div>

          <p className="mt-1.5 body-sm text-foreground-secondary">
            {booking.scheduledStart.toLocaleString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {" · "}
            {booking.durationMinutes} min
          </p>

          <p className="mt-1 inline-flex items-center gap-1.5 caption text-foreground-muted">
            <Icon aria-hidden="true" size={13} />
            {String(booking.mode).replace("_", " ").toLowerCase()}
            {booking.paidAt ? ` · paid ${formatMoneyMinor(booking.grossAmountPaise, booking.currency)}` : ""}
          </p>

          {booking.cancellationReason ? (
            <p className="mt-2 caption text-foreground-muted">{booking.cancellationReason}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {booking.unreadMessages > 0 ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {booking.unreadMessages} new
            </span>
          ) : null}

          {join.allowed ? (
            <Button href={`/consultations/session/${booking.id}`} size="sm">
              Join
            </Button>
          ) : null}

          {side === "customer" && booking.status === ConsultationStatus.PENDING_PAYMENT ? (
            <span className="caption text-warning">Awaiting payment</span>
          ) : null}

          {cancel.allowed ? (
            <Button disabled={pending} onClick={onCancel} size="sm" type="button" variant="secondary">
              {pending ? "Cancelling..." : "Cancel"}
            </Button>
          ) : null}
        </div>
      </div>

      <div aria-live="polite">
        {error ? (
          <p className="mt-3 rounded-md border border-danger/50 bg-background p-3 body-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-3 rounded-md border border-success/50 bg-background p-3 body-sm text-success" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </article>
  );
}
