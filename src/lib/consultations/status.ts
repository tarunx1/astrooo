import { ConsultationStatus } from "@prisma/client";

/**
 * Consultation status, in one place.
 *
 * Labels, tones, the transition table and the timing policy all live here so
 * that "can this be cancelled?" and "what does CONFIRMED look like?" have one
 * answer each rather than one per component. Adding a status makes the
 * exhaustive records below fail to compile, which is the point: a new state
 * cannot quietly render as a blank badge.
 *
 * Kept free of `server-only` and of Prisma's runtime so the rules can be
 * unit-tested and used from client components.
 */
const S = ConsultationStatus;

export const CONSULTATION_STATUS_LABEL: Readonly<Record<ConsultationStatus, string>> = {
  [S.PENDING_PAYMENT]: "Awaiting payment",
  [S.REQUESTED]: "Requested",
  [S.CONFIRMED]: "Confirmed",
  [S.IN_PROGRESS]: "In progress",
  [S.COMPLETED]: "Completed",
  [S.CANCELLED]: "Cancelled",
  [S.NO_SHOW]: "No show",
  [S.REFUNDED]: "Refunded",
};

export type ConsultationTone = "positive" | "warning" | "danger" | "neutral" | "info";

export const CONSULTATION_STATUS_TONE: Readonly<Record<ConsultationStatus, ConsultationTone>> = {
  [S.PENDING_PAYMENT]: "warning",
  [S.REQUESTED]: "warning",
  [S.CONFIRMED]: "info",
  [S.IN_PROGRESS]: "info",
  [S.COMPLETED]: "positive",
  [S.CANCELLED]: "neutral",
  [S.NO_SHOW]: "danger",
  [S.REFUNDED]: "neutral",
};

/**
 * States in which a consultation holds its slot.
 *
 * A booking awaiting payment still holds the time - otherwise two customers
 * could each be taken to checkout for the same slot and one would pay for
 * something already gone. The hold is released by cancellation or expiry.
 */
export const SLOT_HOLDING_STATUSES: readonly ConsultationStatus[] = [
  S.PENDING_PAYMENT,
  S.REQUESTED,
  S.CONFIRMED,
  S.IN_PROGRESS,
];

/** States a customer sees under "Upcoming". */
export const UPCOMING_STATUSES: readonly ConsultationStatus[] = [
  S.PENDING_PAYMENT,
  S.REQUESTED,
  S.CONFIRMED,
  S.IN_PROGRESS,
];

/** States that are over, however they ended. */
export const CLOSED_STATUSES: readonly ConsultationStatus[] = [
  S.COMPLETED,
  S.CANCELLED,
  S.NO_SHOW,
  S.REFUNDED,
];

export function isLive(status: ConsultationStatus): boolean {
  return SLOT_HOLDING_STATUSES.includes(status);
}

/**
 * Which statuses may follow which.
 *
 * Enforced at the service boundary rather than only in the UI, so a crafted
 * request cannot walk a consultation backwards out of COMPLETED or mark one
 * confirmed without a verified payment.
 */
export const CONSULTATION_TRANSITIONS: Readonly<Record<ConsultationStatus, readonly ConsultationStatus[]>> = {
  // Only a verified payment moves this to CONFIRMED; nothing in the UI can.
  [S.PENDING_PAYMENT]: [S.CONFIRMED, S.CANCELLED],
  [S.REQUESTED]: [S.CONFIRMED, S.IN_PROGRESS, S.CANCELLED, S.NO_SHOW],
  [S.CONFIRMED]: [S.IN_PROGRESS, S.COMPLETED, S.CANCELLED, S.NO_SHOW],
  [S.IN_PROGRESS]: [S.COMPLETED, S.NO_SHOW],
  [S.COMPLETED]: [S.REFUNDED],
  [S.CANCELLED]: [S.REFUNDED],
  [S.NO_SHOW]: [S.REFUNDED],
  [S.REFUNDED]: [],
};

export function canTransitionConsultation(
  from: ConsultationStatus,
  to: ConsultationStatus,
): boolean {
  return CONSULTATION_TRANSITIONS[from].includes(to);
}

/* ------------------------------------------------------------------ */
/* Timing policy                                                       */
/* ------------------------------------------------------------------ */

/**
 * The timing rules, in one place.
 *
 * Cancellation windows and join windows are the kind of thing that ends up
 * recomputed slightly differently in a badge, a button and a server action -
 * and then a customer is told they can cancel by a page that the action
 * refuses. One module, used by both sides.
 */
export const CONSULTATION_POLICY = {
  /** How long an unpaid booking holds its slot before it can be reclaimed. */
  paymentHoldMinutes: 15,
  /** A customer may cancel up to this long before the start. */
  freeCancellationMinutes: 120,
  /** Either party may join from this long before the start. */
  joinOpensBeforeMinutes: 10,
  /** Joining closes this long after the scheduled start. */
  joinClosesAfterStartMinutes: 30,
} as const;

/** Whether an unpaid booking has outlived its hold. */
export function paymentHoldExpired(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() > CONSULTATION_POLICY.paymentHoldMinutes * 60_000;
}

export type CancellationDecision =
  | { allowed: true; refundable: boolean }
  | { allowed: false; reason: string };

/**
 * Whether a consultation may be cancelled, and whether a refund is due.
 *
 * "Refundable" is a statement about policy, not an instruction to move money:
 * no refund is issued automatically anywhere in this application. It tells an
 * operator which cancellations they owe a refund on.
 */
export function cancellationDecision(input: {
  status: ConsultationStatus;
  scheduledStart: Date;
  now?: Date;
}): CancellationDecision {
  const now = input.now ?? new Date();

  if (!isLive(input.status)) {
    return { allowed: false, reason: "This consultation is already closed." };
  }

  if (input.status === ConsultationStatus.IN_PROGRESS) {
    return { allowed: false, reason: "This consultation has already started." };
  }

  const minutesUntilStart = (input.scheduledStart.getTime() - now.getTime()) / 60_000;

  if (minutesUntilStart <= 0) {
    return { allowed: false, reason: "This consultation has already started." };
  }

  return {
    allowed: true,
    refundable: minutesUntilStart >= CONSULTATION_POLICY.freeCancellationMinutes,
  };
}

export type JoinDecision = { allowed: true } | { allowed: false; reason: string };

/**
 * Whether the session may be joined right now.
 *
 * Used by the UI to enable the button and by the token endpoint to mint - or
 * refuse - a participant token. Both call this, so a stale page cannot be used
 * to join outside the window.
 */
export function joinDecision(input: {
  status: ConsultationStatus;
  scheduledStart: Date;
  now?: Date;
}): JoinDecision {
  const now = input.now ?? new Date();

  if (input.status !== ConsultationStatus.CONFIRMED && input.status !== ConsultationStatus.IN_PROGRESS) {
    return {
      allowed: false,
      reason:
        input.status === ConsultationStatus.PENDING_PAYMENT
          ? "This consultation is not confirmed yet."
          : "This consultation is not open to join.",
    };
  }

  const minutesUntilStart = (input.scheduledStart.getTime() - now.getTime()) / 60_000;

  if (minutesUntilStart > CONSULTATION_POLICY.joinOpensBeforeMinutes) {
    return {
      allowed: false,
      reason: `You can join from ${CONSULTATION_POLICY.joinOpensBeforeMinutes} minutes before the start.`,
    };
  }

  if (-minutesUntilStart > CONSULTATION_POLICY.joinClosesAfterStartMinutes) {
    return { allowed: false, reason: "The joining window for this consultation has closed." };
  }

  return { allowed: true };
}
