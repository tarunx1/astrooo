import "server-only";

import { AuditAction, PayoutStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/admin/audit";
import { getSecret } from "@/lib/settings/service";
import { canTransitionPayout } from "@/lib/payouts/states";
import {
  PayoutProviderNotConfiguredError,
  payoutIdempotencyKey,
  type PayoutProvider,
  type PayoutStatusResult,
  type PayoutTransferResult,
} from "@/lib/payouts/provider";
import { logger, reportIncident } from "@/lib/observability/logger";

/**
 * Automated disbursement.
 *
 * The state machine here is the whole point, and it is deliberately not the
 * obvious one:
 *
 *   ELIGIBLE -> PROCESSING   when a transfer is *requested*
 *   PROCESSING -> PAID       only on provider confirmation
 *   PROCESSING -> FAILED     only on provider rejection
 *
 * A payout is never marked PAID because an API call returned 200. Acceptance
 * means in flight; money arriving is a separate event that the provider tells
 * us about. Collapsing the two is how a platform ends up with a ledger that
 * says paid and a bank statement that says otherwise.
 *
 * No provider adapter is implemented yet. The interface, the configuration
 * check, the idempotency key and the state transitions are real; the rail is
 * not connected, and `isDisbursementConfigured` reports that honestly so
 * nothing in the UI claims a transfer was sent.
 */

/**
 * The configured payout provider, or null.
 *
 * Returns null rather than a stub that pretends to work. A caller that cannot
 * get a provider must tell the operator that automated payout is unavailable,
 * which is the truth.
 */
export function getPayoutProvider(): PayoutProvider | null {
  // When an adapter is added it is selected here, gated on its own credentials.
  // Until then there is nothing to return, and saying so is the correct
  // behaviour rather than returning something that fakes success.
  return null;
}

/**
 * Whether automated disbursement can run.
 *
 * Both halves of the credential must be present, for the same reason the
 * payment config refuses a partial bundle: an id from one place paired with a
 * secret from another is a pair that never existed together.
 */
export async function isDisbursementConfigured(
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const provider = getPayoutProvider();
  if (!provider) return false;

  const [id, secret] = await Promise.all([
    getSecret("payouts.providerKeyId", env),
    getSecret("payouts.providerKeySecret", env),
  ]);

  return Boolean(id && secret) && provider.isProductionConnected;
}

export type DisbursementResult =
  | { ok: true; providerPayoutId: string }
  | { ok: false; message: string; unavailable?: boolean };

/**
 * Requests a transfer for one payout.
 *
 * Moves the payout to PROCESSING *before* calling the provider, so a crash
 * between the call and the write cannot leave a payout that looks untouched
 * while money is in flight. The idempotency key is derived from the payout id,
 * so a retry of the same payout collapses at the provider rather than sending
 * twice.
 */
export async function requestPayoutTransfer(input: {
  payoutId: string;
  actorUserId: string;
}): Promise<DisbursementResult> {
  const provider = getPayoutProvider();

  if (!provider || !(await isDisbursementConfigured())) {
    return {
      ok: false,
      unavailable: true,
      message:
        "Automated payouts are not configured on this deployment. Record the transfer manually once it has been made.",
    };
  }

  const payout = await prisma.payout.findUnique({
    where: { id: input.payoutId },
    select: {
      id: true,
      status: true,
      amountPaise: true,
      currency: true,
      panditProfileId: true,
      pandit: {
        select: {
          payoutAccount: {
            select: { accountHolderName: true, accountLast4: true, upiMasked: true },
          },
        },
      },
    },
  });

  if (!payout) return { ok: false, message: "That payout could not be found." };

  if (!canTransitionPayout(payout.status, PayoutStatus.PROCESSING)) {
    return {
      ok: false,
      message: `A payout in ${payout.status} cannot be sent for transfer.`,
    };
  }

  const destination = payout.pandit.payoutAccount;
  if (!destination) {
    return { ok: false, message: "That practitioner has no payout account on file." };
  }

  // PROCESSING first. If the process dies mid-call, an operator sees a payout
  // that is in flight and reconciles it, rather than one that looks untouched.
  await prisma.payout.update({
    where: { id: payout.id },
    data: { status: PayoutStatus.PROCESSING, processedById: input.actorUserId },
  });

  let result: PayoutTransferResult;

  try {
    result = await provider.requestTransfer({
      payoutId: payout.id,
      amountMinor: payout.amountPaise,
      currency: "INR",
      destination: {
        panditProfileId: payout.panditProfileId,
        accountHolderName: destination.accountHolderName,
        accountLast4: destination.accountLast4,
        upiMasked: destination.upiMasked,
      },
      idempotencyKey: payoutIdempotencyKey(payout.id),
      narration: `Tarun Astro payout ${payout.id.slice(-8)}`,
    });
  } catch (error) {
    if (error instanceof PayoutProviderNotConfiguredError) {
      return { ok: false, unavailable: true, message: error.message };
    }

    // The outcome is genuinely unknown: the request may have reached the
    // provider. The payout stays PROCESSING so it is reconciled rather than
    // retried blindly into a duplicate transfer.
    reportIncident("payout_provider_failure", { payoutId: payout.id }, error);

    return {
      ok: false,
      message:
        "The transfer could not be confirmed. It is marked processing and must be reconciled against the provider before retrying.",
    };
  }

  if (result.status === "rejected") {
    await applyProviderStatus({
      payoutId: payout.id,
      state: "failed",
      failureReason: result.reason,
      actorUserId: input.actorUserId,
      providerPayoutId: result.providerPayoutId ?? null,
    });

    return { ok: false, message: result.reason };
  }

  if (result.status === "unknown") {
    reportIncident("payout_provider_failure", { payoutId: payout.id, reason: result.reason });
    return {
      ok: false,
      message:
        "The transfer could not be confirmed. It is marked processing and must be reconciled before retrying.",
    };
  }

  await prisma.payout.update({
    where: { id: payout.id },
    data: { reference: result.providerPayoutId },
  });

  await recordAudit(prisma, {
    actorUserId: input.actorUserId,
    action: AuditAction.PAYOUT_PROCESSING,
    entityType: "Payout",
    entityId: payout.id,
    metadata: {
      provider: provider.name,
      providerPayoutId: result.providerPayoutId,
      providerStatus: result.providerStatus,
      amountPaise: payout.amountPaise,
    },
  });

  logger.info("payout_transfer_requested", {
    payoutId: payout.id,
    provider: provider.name,
    providerPayoutId: result.providerPayoutId,
  });

  // Accepted, not paid. Confirmation arrives separately.
  return { ok: true, providerPayoutId: result.providerPayoutId };
}

/**
 * Applies a provider-reported state to a payout.
 *
 * The only path by which a payout reaches PAID. Called from a webhook or a
 * status poll; both are idempotent, because a provider will redeliver and a
 * poll may race a webhook.
 */
export async function applyProviderStatus(input: {
  payoutId: string;
  state: PayoutStatusResult["state"];
  actorUserId: string;
  providerPayoutId?: string | null;
  failureReason?: string;
  utr?: string | null;
}): Promise<{ ok: true; changed: boolean } | { ok: false; message: string }> {
  return prisma.$transaction(async (tx) => {
    const payout = await tx.payout.findUnique({
      where: { id: input.payoutId },
      select: { id: true, status: true, panditProfileId: true, amountPaise: true },
    });

    if (!payout) return { ok: false as const, message: "That payout could not be found." };

    const target =
      input.state === "paid"
        ? PayoutStatus.PAID
        : input.state === "failed" || input.state === "reversed"
          ? PayoutStatus.FAILED
          : null;

    // "processing" and "unknown" carry no state change; they are heartbeats.
    if (target === null) return { ok: true as const, changed: false };

    // Already there. A redelivered webhook must not write again.
    if (payout.status === target) return { ok: true as const, changed: false };

    if (!canTransitionPayout(payout.status, target)) {
      reportIncident("payout_provider_failure", {
        payoutId: payout.id,
        from: payout.status,
        to: target,
        reason: "illegal_transition",
      });
      return { ok: false as const, message: `A payout cannot move from ${payout.status} to ${target}.` };
    }

    const now = new Date();

    await tx.payout.update({
      where: { id: payout.id },
      data: {
        status: target,
        ...(target === PayoutStatus.PAID
          ? {
              processedAt: now,
              // The provider's bank reference, when it issued one; otherwise
              // its own payout id, so the row is always reconcilable.
              reference: input.utr ?? input.providerPayoutId ?? undefined,
              failureReason: null,
            }
          : { failureReason: input.failureReason?.slice(0, 300) ?? "Provider reported a failure." }),
      },
    });

    // The ledger moves with the payout, in the same transaction, so the two can
    // never disagree about whether a practitioner has been paid.
    await tx.earningTransaction.updateMany({
      where: { payoutId: payout.id },
      data:
        target === PayoutStatus.PAID
          ? { status: "PAID", settledAt: now }
          : { status: "FAILED" },
    });

    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      action: target === PayoutStatus.PAID ? AuditAction.PAYOUT_PAID : AuditAction.PAYOUT_FAILED,
      entityType: "Payout",
      entityId: payout.id,
      metadata: {
        panditProfileId: payout.panditProfileId,
        amountPaise: payout.amountPaise,
        from: payout.status,
        to: target,
        providerPayoutId: input.providerPayoutId ?? undefined,
        // A UTR identifies a transfer, not a credential, and reconciliation
        // depends on it being recorded.
        utr: input.utr ?? undefined,
      },
    });

    logger.info("payout_status_applied", {
      payoutId: payout.id,
      to: target,
      providerPayoutId: input.providerPayoutId ?? undefined,
    });

    return { ok: true as const, changed: true };
  });
}

/** A description of disbursement readiness, for the integrations page. */
export async function describeDisbursement(): Promise<{
  configured: boolean;
  providerName: string | null;
  detail: string;
}> {
  const provider = getPayoutProvider();

  if (!provider) {
    return {
      configured: false,
      providerName: null,
      detail:
        "No payout provider adapter is implemented. Payouts are recorded against an operator's own bank transfer.",
    };
  }

  const configured = await isDisbursementConfigured();

  return {
    configured,
    providerName: provider.name,
    detail: configured
      ? "Automated transfers are available."
      : `${provider.name} has no credentials configured on this deployment.`,
  };
}
