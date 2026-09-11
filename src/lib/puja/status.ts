import { PujaBookingStatus } from "@prisma/client";

/**
 * Puja booking status, in one place.
 *
 * Labels, tones and the transition table together, so a new status makes the
 * exhaustive records fail to compile rather than render as a blank badge.
 *
 * Kept pure so both the operator UI and the service can read the same rules.
 */
const S = PujaBookingStatus;

export const PUJA_STATUS_LABEL: Readonly<Record<PujaBookingStatus, string>> = {
  [S.PENDING_PAYMENT]: "Awaiting payment",
  [S.CONFIRMED]: "Confirmed",
  [S.PANDIT_PENDING]: "Awaiting assignment",
  [S.ASSIGNED]: "Practitioner assigned",
  [S.SCHEDULED]: "Scheduled",
  [S.IN_PROGRESS]: "In progress",
  [S.COMPLETED]: "Completed",
  [S.CANCELLED]: "Cancelled",
  [S.REFUNDED]: "Refunded",
};

export type PujaTone = "positive" | "warning" | "danger" | "neutral" | "info";

export const PUJA_STATUS_TONE: Readonly<Record<PujaBookingStatus, PujaTone>> = {
  [S.PENDING_PAYMENT]: "warning",
  [S.CONFIRMED]: "info",
  [S.PANDIT_PENDING]: "warning",
  [S.ASSIGNED]: "info",
  [S.SCHEDULED]: "info",
  [S.IN_PROGRESS]: "info",
  [S.COMPLETED]: "positive",
  [S.CANCELLED]: "neutral",
  [S.REFUNDED]: "neutral",
};

/**
 * Which statuses may follow which.
 *
 * A paid booking lands in PANDIT_PENDING because somebody still has to be
 * assigned to perform it; CONFIRMED exists for a booking an operator has
 * acknowledged but not yet queued. Nothing returns from COMPLETED except a
 * refund.
 */
export const PUJA_TRANSITIONS: Readonly<Record<PujaBookingStatus, readonly PujaBookingStatus[]>> = {
  [S.PENDING_PAYMENT]: [S.PANDIT_PENDING, S.CONFIRMED, S.CANCELLED],
  [S.CONFIRMED]: [S.PANDIT_PENDING, S.ASSIGNED, S.CANCELLED],
  [S.PANDIT_PENDING]: [S.ASSIGNED, S.CANCELLED],
  [S.ASSIGNED]: [S.SCHEDULED, S.PANDIT_PENDING, S.CANCELLED],
  [S.SCHEDULED]: [S.IN_PROGRESS, S.COMPLETED, S.ASSIGNED, S.CANCELLED],
  [S.IN_PROGRESS]: [S.COMPLETED, S.CANCELLED],
  [S.COMPLETED]: [S.REFUNDED],
  [S.CANCELLED]: [S.REFUNDED],
  [S.REFUNDED]: [],
};

export function canTransitionPuja(from: PujaBookingStatus, to: PujaBookingStatus): boolean {
  return PUJA_TRANSITIONS[from].includes(to);
}

/** Statuses in which a booking is still being worked. */
export function isPujaOpen(status: PujaBookingStatus): boolean {
  return (
    status !== S.COMPLETED && status !== S.CANCELLED && status !== S.REFUNDED
  );
}
