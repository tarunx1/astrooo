import "server-only";

import {
  AuditAction,
  ConsultationStatus,
  EarningStatus,
  PayoutStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/admin/audit";
import { getSettings } from "@/lib/settings/service";
import { PAYOUT_TRANSITIONS, canTransitionPayout, formatPaise } from "@/lib/payouts/states";

/**
 * The state rules and money formatting live in `states.ts` because they are
 * pure and the client components that render payout controls need them. They
 * are re-exported here so server callers keep one import.
 */
export { PAYOUT_TRANSITIONS, canTransitionPayout, formatPaise };

/**
 * The earnings ledger.
 *
 * Money owed is a stored fact, not a number recomputed from whatever the
 * dashboard happens to be showing. Every completed, paid consultation produces
 * exactly one `EarningTransaction` carrying its own split - gross, commission
 * percentage used, platform share, tax, adjustment, net - in integer paise.
 *
 * Two invariants do the heavy lifting:
 *
 *  * `EarningTransaction.consultationId` is unique. Settling the same
 *    consultation twice is refused by the database, however the second attempt
 *    arrived: a retried webhook, a double-clicked button, two workers.
 *
 *  * The commission percentage is snapshotted onto the row. Changing the
 *    platform commission next month therefore reprices future work and rewrites
 *    nothing that has already been earned.
 *
 * No money moves from this application. There is no payout provider wired, so
 * `Payout` records an operator's off-platform transfer and its reference. The
 * ledger, the state machine and the idempotency are real; a bank instruction is
 * not simulated.
 */

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerError";
  }
}

export type EarningSplit = {
  grossAmountPaise: number;
  commissionPercent: number;
  platformCommissionPaise: number;
  taxPaise: number;
  adjustmentPaise: number;
  netPayablePaise: number;
};

/**
 * Splits one gross amount.
 *
 * Integer arithmetic throughout, with the platform's share rounded and the
 * Pandit's share taken as the remainder. Taking the remainder rather than
 * rounding both independently is what guarantees the two halves always sum back
 * to the gross - rounding each would leave a stray paisa that belongs to
 * nobody.
 */
export function splitEarning(input: {
  grossAmountPaise: number;
  commissionPercent: number;
  taxPaise?: number;
  adjustmentPaise?: number;
}): EarningSplit {
  if (!Number.isInteger(input.grossAmountPaise) || input.grossAmountPaise < 0) {
    throw new LedgerError("Gross amount must be a non-negative whole number of paise.");
  }
  if (!Number.isInteger(input.commissionPercent) || input.commissionPercent < 0 || input.commissionPercent > 100) {
    throw new LedgerError("Commission must be a whole percentage between 0 and 100.");
  }

  const taxPaise = input.taxPaise ?? 0;
  const adjustmentPaise = input.adjustmentPaise ?? 0;

  const platformCommissionPaise = Math.round((input.grossAmountPaise * input.commissionPercent) / 100);
  const netPayablePaise = input.grossAmountPaise - platformCommissionPaise - taxPaise + adjustmentPaise;

  return {
    grossAmountPaise: input.grossAmountPaise,
    commissionPercent: input.commissionPercent,
    platformCommissionPaise,
    taxPaise,
    adjustmentPaise,
    // An adjustment large enough to go negative would mean the platform is owed
    // money by the Pandit, which this ledger has no concept of. Clamp and let
    // an operator handle it as its own adjustment rather than emitting a
    // negative payable that a payout would then try to transfer.
    netPayablePaise: Math.max(0, netPayablePaise),
  };
}

/**
 * Creates the earning for a completed consultation.
 *
 * Idempotent: a consultation that already has an earning returns the existing
 * one rather than creating a second, and a concurrent duplicate is caught by
 * the unique constraint rather than by a check that raced.
 */
export async function settleConsultation(input: {
  consultationId: string;
  actorUserId?: string | null;
}): Promise<{ ok: true; earningId: string; created: boolean } | { ok: false; message: string }> {
  const settings = await getSettings([
    "payouts.platformCommissionPercent",
    "payouts.holdingPeriodDays",
  ]);

  try {
    return await prisma.$transaction(async (tx) => {
      const consultation = await tx.consultation.findUnique({
        where: { id: input.consultationId },
        select: {
          id: true,
          status: true,
          grossAmountPaise: true,
          currency: true,
          completedAt: true,
          panditProfileId: true,
          commissionPercent: true,
          pandit: { select: { commissionPercent: true } },
          earning: { select: { id: true } },
        },
      });

      if (!consultation) return { ok: false as const, message: "That consultation could not be found." };

      if (consultation.earning) {
        return { ok: true as const, earningId: consultation.earning.id, created: false };
      }

      if (consultation.status !== ConsultationStatus.COMPLETED) {
        return { ok: false as const, message: "Only a completed consultation produces an earning." };
      }

      // The rate the customer was charged at, in order of authority: the
      // snapshot frozen when they paid, then the Pandit's agreed override, then
      // the platform default. The snapshot wins because it is the only one that
      // cannot have changed since the money was taken. The fallbacks exist for
      // consultations booked before paid checkout, which carry no snapshot.
      const commissionPercent =
        consultation.commissionPercent ??
        consultation.pandit.commissionPercent ??
        settings["payouts.platformCommissionPercent"];

      const split = splitEarning({
        grossAmountPaise: consultation.grossAmountPaise,
        commissionPercent,
      });

      const completedAt = consultation.completedAt ?? new Date();
      const eligibleAt = new Date(
        completedAt.getTime() + settings["payouts.holdingPeriodDays"] * 24 * 60 * 60_000,
      );

      const earning = await tx.earningTransaction.create({
        data: {
          panditProfileId: consultation.panditProfileId,
          consultationId: consultation.id,
          status: EarningStatus.PENDING,
          currency: consultation.currency,
          eligibleAt,
          ...split,
        },
        select: { id: true },
      });

      return { ok: true as const, earningId: earning.id, created: true };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.earningTransaction.findUnique({
        where: { consultationId: input.consultationId },
        select: { id: true },
      });
      if (existing) return { ok: true, earningId: existing.id, created: false };
    }
    throw error;
  }
}

/**
 * Promotes earnings whose holding period has elapsed.
 *
 * Only PENDING rows move, and only to ELIGIBLE. A held earning stays held: a
 * hold is an operator's deliberate act and a scheduled sweep must not quietly
 * undo it.
 */
export async function releaseMaturedEarnings(now: Date = new Date()): Promise<number> {
  const result = await prisma.earningTransaction.updateMany({
    where: { status: EarningStatus.PENDING, eligibleAt: { lte: now } },
    data: { status: EarningStatus.ELIGIBLE },
  });
  return result.count;
}

export type EarningsSummary = {
  todayPaise: number;
  weekPaise: number;
  monthPaise: number;
  pendingPaise: number;
  availablePaise: number;
  paidPaise: number;
  totalEarnedPaise: number;
  currency: string;
};

/**
 * A Pandit's earnings at a glance, computed from the ledger.
 *
 * Every figure is a sum over stored rows. Nothing is inferred from a display
 * value, and nothing is estimated: a period with no rows reads zero rather than
 * a projection.
 */
export async function earningsSummary(panditProfileId: string, now: Date = new Date()): Promise<EarningsSummary> {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);

  const sumNet = async (where: Prisma.EarningTransactionWhereInput) => {
    const result = await prisma.earningTransaction.aggregate({
      where: { panditProfileId, ...where },
      _sum: { netPayablePaise: true },
    });
    return result._sum.netPayablePaise ?? 0;
  };

  const [today, week, month, pending, available, paid, total] = await Promise.all([
    sumNet({ createdAt: { gte: startOfToday } }),
    sumNet({ createdAt: { gte: startOfWeek } }),
    sumNet({ createdAt: { gte: startOfMonth } }),
    sumNet({ status: { in: [EarningStatus.PENDING, EarningStatus.HELD] } }),
    sumNet({ status: EarningStatus.ELIGIBLE }),
    sumNet({ status: EarningStatus.PAID }),
    sumNet({ status: { not: EarningStatus.REVERSED } }),
  ]);

  return {
    todayPaise: today,
    weekPaise: week,
    monthPaise: month,
    pendingPaise: pending,
    availablePaise: available,
    paidPaise: paid,
    totalEarnedPaise: total,
    currency: "INR",
  };
}

/* ------------------------------------------------------------------ */
/* Payouts                                                             */
/* ------------------------------------------------------------------ */

function payoutNumber(now: Date): string {
  const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `PO-${stamp}-${suffix}`;
}

/**
 * Gathers a Pandit's eligible earnings into one payout.
 *
 * The claim is a guarded update - only rows still ELIGIBLE and still unattached
 * are taken - so two operators running a cycle at the same time cannot both
 * claim the same earning. The payout amount is then summed from the rows
 * actually claimed, never from what was counted before the claim.
 */
export async function createPayout(input: {
  panditProfileId: string;
  actorUserId: string;
  now?: Date;
}): Promise<{ ok: true; payoutId: string; amountPaise: number } | { ok: false; message: string }> {
  const now = input.now ?? new Date();
  const settings = await getSettings(["payouts.minimumPaise"]);

  return prisma.$transaction(async (tx) => {
    const candidates = await tx.earningTransaction.findMany({
      where: {
        panditProfileId: input.panditProfileId,
        status: EarningStatus.ELIGIBLE,
        payoutId: null,
      },
      select: { id: true, netPayablePaise: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    if (candidates.length === 0) {
      return { ok: false as const, message: "There are no eligible earnings to pay out." };
    }

    const amountPaise = candidates.reduce((total, row) => total + row.netPayablePaise, 0);

    if (amountPaise < settings["payouts.minimumPaise"]) {
      return {
        ok: false as const,
        message: "The eligible total is below the minimum payout. It will roll into the next cycle.",
      };
    }

    const payout = await tx.payout.create({
      data: {
        payoutNumber: payoutNumber(now),
        panditProfileId: input.panditProfileId,
        status: PayoutStatus.ELIGIBLE,
        amountPaise,
        periodStart: candidates[0].createdAt,
        periodEnd: candidates[candidates.length - 1].createdAt,
      },
      select: { id: true },
    });

    // Guarded: the status and null payoutId are part of the WHERE, so an
    // earning another transaction has already claimed is simply not updated.
    const claimed = await tx.earningTransaction.updateMany({
      where: {
        id: { in: candidates.map((row) => row.id) },
        status: EarningStatus.ELIGIBLE,
        payoutId: null,
      },
      data: { payoutId: payout.id, status: EarningStatus.PROCESSING },
    });

    if (claimed.count !== candidates.length) {
      // Someone else claimed part of this batch between the read and the write.
      // Rolling back is right: a payout whose amount does not match the rows it
      // actually owns is worse than no payout.
      throw new LedgerError("Those earnings were claimed by another payout. Try again.");
    }

    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      action: AuditAction.PAYOUT_CREATED,
      entityType: "Payout",
      entityId: payout.id,
      metadata: {
        panditProfileId: input.panditProfileId,
        amountPaise,
        earningCount: claimed.count,
      },
    });

    return { ok: true as const, payoutId: payout.id, amountPaise };
  });
}

const PAYOUT_AUDIT: Record<PayoutStatus, AuditAction> = {
  [PayoutStatus.PENDING]: AuditAction.PAYOUT_CREATED,
  [PayoutStatus.ELIGIBLE]: AuditAction.PAYOUT_RELEASED,
  [PayoutStatus.PROCESSING]: AuditAction.PAYOUT_PROCESSING,
  [PayoutStatus.PAID]: AuditAction.PAYOUT_PAID,
  [PayoutStatus.FAILED]: AuditAction.PAYOUT_FAILED,
  [PayoutStatus.HELD]: AuditAction.PAYOUT_HELD,
};

/**
 * Moves a payout through its states.
 *
 * The current state is re-read inside the transaction and the move re-checked
 * against it, so two operators acting at once cannot both apply a transition
 * that was only legal from the state the first one left. Reaching PAID settles
 * every earning in the batch in the same transaction, which is what keeps the
 * ledger and the payout from ever disagreeing.
 */
export async function transitionPayout(input: {
  payoutId: string;
  to: PayoutStatus;
  actorUserId: string;
  reference?: string | null;
  reason?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return prisma.$transaction(async (tx) => {
    const payout = await tx.payout.findUnique({
      where: { id: input.payoutId },
      select: { id: true, status: true, panditProfileId: true, amountPaise: true },
    });

    if (!payout) return { ok: false as const, message: "That payout could not be found." };

    if (!canTransitionPayout(payout.status, input.to)) {
      return {
        ok: false as const,
        message: `A payout cannot move from ${payout.status} to ${input.to}.`,
      };
    }

    if (input.to === PayoutStatus.PAID && !input.reference?.trim()) {
      // Marking a transfer paid without saying which transfer it was would make
      // the ledger unreconcilable against a bank statement.
      return { ok: false as const, message: "Record the transfer reference before marking it paid." };
    }

    if (input.to === PayoutStatus.FAILED && !input.reason?.trim()) {
      return { ok: false as const, message: "Say why the transfer failed." };
    }

    const now = new Date();

    await tx.payout.update({
      where: { id: payout.id },
      data: {
        status: input.to,
        processedById: input.actorUserId,
        ...(input.to === PayoutStatus.PAID
          ? { processedAt: now, reference: input.reference!.trim().slice(0, 120), failureReason: null }
          : {}),
        ...(input.to === PayoutStatus.FAILED ? { failureReason: input.reason!.trim().slice(0, 300) } : {}),
        ...(input.to === PayoutStatus.HELD ? { heldReason: input.reason?.trim().slice(0, 300) ?? null } : {}),
      },
    });

    if (input.to === PayoutStatus.PAID) {
      await tx.earningTransaction.updateMany({
        where: { payoutId: payout.id },
        data: { status: EarningStatus.PAID, settledAt: now },
      });
    }

    if (input.to === PayoutStatus.FAILED) {
      // The earnings stay attached to the failed payout so the retry pays the
      // same rows. Releasing them here would let a second payout claim them
      // while the first is being retried, and the Pandit would be paid twice.
      await tx.earningTransaction.updateMany({
        where: { payoutId: payout.id },
        data: { status: EarningStatus.FAILED },
      });
    }

    if (input.to === PayoutStatus.PROCESSING) {
      await tx.earningTransaction.updateMany({
        where: { payoutId: payout.id },
        data: { status: EarningStatus.PROCESSING },
      });
    }

    if (input.to === PayoutStatus.HELD) {
      await tx.earningTransaction.updateMany({
        where: { payoutId: payout.id },
        data: { status: EarningStatus.HELD, heldReason: input.reason?.trim().slice(0, 300) ?? null },
      });
    }

    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      action: PAYOUT_AUDIT[input.to],
      entityType: "Payout",
      entityId: payout.id,
      metadata: {
        panditProfileId: payout.panditProfileId,
        from: payout.status,
        to: input.to,
        amountPaise: payout.amountPaise,
        // The reference identifies a transfer, not a credential, and being able
        // to reconcile a payout against a statement is the point of the log.
        reference: input.to === PayoutStatus.PAID ? input.reference?.trim().slice(0, 120) : undefined,
      },
    });

    return { ok: true as const };
  });
}
