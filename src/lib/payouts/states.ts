import { PayoutStatus } from "@prisma/client";

/**
 * Payout state rules and money formatting.
 *
 * Split from `ledger.ts` because that module is `server-only` and reaches
 * Prisma, while these are pure and are needed by the client components that
 * render the controls. Importing the service from a client component pulled the
 * database driver into the browser bundle; keeping the rules here means both
 * sides read the same table without either side dragging the other's
 * dependencies along.
 */
export const PAYOUT_TRANSITIONS: Readonly<Record<PayoutStatus, readonly PayoutStatus[]>> = {
  [PayoutStatus.PENDING]: [PayoutStatus.ELIGIBLE, PayoutStatus.HELD],
  [PayoutStatus.ELIGIBLE]: [PayoutStatus.PROCESSING, PayoutStatus.HELD],
  [PayoutStatus.PROCESSING]: [PayoutStatus.PAID, PayoutStatus.FAILED],
  // A failed transfer is retried by going back to PROCESSING, which is why the
  // original payout is never deleted: the failure is part of its history.
  [PayoutStatus.FAILED]: [PayoutStatus.PROCESSING, PayoutStatus.HELD],
  [PayoutStatus.HELD]: [PayoutStatus.ELIGIBLE],
  [PayoutStatus.PAID]: [],
};

export function canTransitionPayout(from: PayoutStatus, to: PayoutStatus): boolean {
  return PAYOUT_TRANSITIONS[from].includes(to);
}

/** Rupee rendering for display. Money is never held as a float anywhere else. */
export function formatPaise(paise: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(paise / 100);
}
