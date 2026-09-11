"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, PayoutStatus } from "@prisma/client";
import { z } from "zod";
import { authorizeAction, authorizeSuperAdmin } from "@/lib/auth/access";
import { recordAudit } from "@/lib/admin/audit";
import { prisma } from "@/lib/db/prisma";
import { createPayout, releaseMaturedEarnings, transitionPayout } from "@/lib/payouts/ledger";
import { setSetting } from "@/lib/settings/service";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * Payout Server Actions.
 *
 * Processing a payout needs `payouts.process`, which is delegable. Changing the
 * rules that decide what anyone is owed - commission, cycle, holding period,
 * minimum - needs SUPER_ADMIN and is not delegable at all.
 *
 * Nothing here moves money. `PAID` records that an operator made a transfer
 * elsewhere and what its reference was; the state machine and the ledger are
 * real, the bank instruction is not simulated.
 */
const idSchema = z.string().trim().min(1).max(64);

function denied(reason?: string): AdminActionState {
  return { ok: false, error: reason ?? "You are not authorised to perform this action.", fieldErrors: {} };
}

function failure(error: string): AdminActionState {
  return { ok: false, error, fieldErrors: {} };
}

function success(message: string): AdminActionState {
  return { ok: true, error: null, message, fieldErrors: {} };
}

function revalidatePayouts(panditProfileId?: string): void {
  revalidatePath("/admin/payouts");
  revalidatePath("/admin/earnings");
  revalidatePath("/admin/audit");
  revalidatePath("/pandit/payouts");
  revalidatePath("/pandit/earnings");
  if (panditProfileId) revalidatePath(`/admin/pandits/${panditProfileId}`);
}

export async function createPayoutAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeAction("payouts.process");
  if (!auth.ok) return denied(auth.error);

  const parsed = z.object({ panditProfileId: idSchema }).safeParse({
    panditProfileId: formData.get("panditProfileId"),
  });

  if (!parsed.success) return failure("That Pandit is not recognised.");

  const result = await createPayout({
    panditProfileId: parsed.data.panditProfileId,
    actorUserId: auth.viewer.id,
  });

  if (!result.ok) return failure(result.message);

  revalidatePayouts(parsed.data.panditProfileId);
  return success("Payout raised from the eligible earnings.");
}

export async function transitionPayoutAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeAction("payouts.process");
  if (!auth.ok) return denied(auth.error);

  const parsed = z
    .object({
      payoutId: idSchema,
      to: z.nativeEnum(PayoutStatus),
      reference: z.string().trim().max(120).optional(),
      reason: z.string().trim().max(300).optional(),
    })
    .safeParse({
      payoutId: formData.get("payoutId"),
      to: formData.get("to"),
      reference: (formData.get("reference") as string) || undefined,
      reason: (formData.get("reason") as string) || undefined,
    });

  if (!parsed.success) return failure("That payout change is not recognised.");

  const result = await transitionPayout({
    payoutId: parsed.data.payoutId,
    to: parsed.data.to,
    actorUserId: auth.viewer.id,
    reference: parsed.data.reference ?? null,
    reason: parsed.data.reason ?? null,
  });

  if (!result.ok) return failure(result.message);

  revalidatePayouts();
  return success("Payout updated.");
}

/**
 * Promotes earnings whose holding period has elapsed.
 *
 * Run on demand from the dashboard because no scheduler is wired in this
 * application. The sweep is idempotent - it only moves PENDING rows whose
 * `eligibleAt` has passed - so running it twice changes nothing the second
 * time.
 */
export async function releaseEarningsAction(
  _state: AdminActionState,
  _formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeAction("payouts.process");
  if (!auth.ok) return denied(auth.error);

  const count = await releaseMaturedEarnings();

  revalidatePayouts();
  return success(
    count === 0
      ? "No earnings have matured past their holding period yet."
      : `${count} earning${count === 1 ? "" : "s"} are now eligible for payout.`,
  );
}

/** Holds or releases one earning, with a reason. */
export async function holdEarningAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeAction("payouts.process");
  if (!auth.ok) return denied(auth.error);

  const parsed = z
    .object({ earningId: idSchema, hold: z.boolean(), reason: z.string().trim().max(300).optional() })
    .safeParse({
      earningId: formData.get("earningId"),
      hold: formData.get("hold") === "true",
      reason: (formData.get("reason") as string) || undefined,
    });

  if (!parsed.success) return failure("That request is not recognised.");
  if (parsed.data.hold && !parsed.data.reason?.trim()) {
    return failure("Say why the earning is being held.");
  }

  const earning = await prisma.earningTransaction.findUnique({
    where: { id: parsed.data.earningId },
    select: { id: true, status: true, payoutId: true, panditProfileId: true },
  });

  if (!earning) return failure("That earning could not be found.");

  // An earning already claimed by a payout is not free to hold: it would leave
  // the payout's amount disagreeing with the rows it owns.
  if (earning.payoutId) {
    return failure("That earning is part of a payout. Hold the payout instead.");
  }

  const allowed = parsed.data.hold
    ? earning.status === "PENDING" || earning.status === "ELIGIBLE"
    : earning.status === "HELD";

  if (!allowed) return failure(`An earning in ${earning.status} cannot be changed this way.`);

  await prisma.$transaction(async (tx) => {
    await tx.earningTransaction.update({
      where: { id: earning.id },
      data: {
        status: parsed.data.hold ? "HELD" : "PENDING",
        heldReason: parsed.data.hold ? (parsed.data.reason?.trim() ?? null) : null,
      },
    });

    await recordAudit(tx, {
      actorUserId: auth.viewer.id,
      action: AuditAction.EARNING_ADJUSTED,
      entityType: "EarningTransaction",
      entityId: earning.id,
      metadata: {
        panditProfileId: earning.panditProfileId,
        from: earning.status,
        to: parsed.data.hold ? "HELD" : "PENDING",
        reason: parsed.data.reason ?? null,
      },
    });
  });

  revalidatePayouts(earning.panditProfileId);
  return success(parsed.data.hold ? "Earning held." : "Hold released.");
}

/**
 * Changes the payout rules.
 *
 * Each value goes through the typed settings registry, so a key that is not
 * declared there is refused and a value that fails its schema never lands.
 * Automatic transfers stay off: there is no payout provider wired, and a switch
 * that claimed to enable one would be a lie told by the UI.
 */
export async function updatePayoutSettingsAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return denied(auth.error);

  const parsed = z
    .object({
      cycle: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "MANUAL"]),
      cycleAnchorDay: z.number().int().min(1).max(28),
      holdingPeriodDays: z.number().int().min(0).max(90),
      minimumRupees: z.number().min(0).max(100_000),
      platformCommissionPercent: z.number().int().min(0).max(90),
    })
    .safeParse({
      cycle: formData.get("cycle"),
      cycleAnchorDay: Number(formData.get("cycleAnchorDay")),
      holdingPeriodDays: Number(formData.get("holdingPeriodDays")),
      minimumRupees: Number(formData.get("minimumRupees")),
      platformCommissionPercent: Number(formData.get("platformCommissionPercent")),
    });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the values below.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const previous = await prisma.systemSetting.findMany({
    where: { category: "payouts" },
    select: { key: true, valueJson: true },
  });

  await setSetting("payouts.cycle", parsed.data.cycle, auth.viewer.id);
  await setSetting("payouts.cycleAnchorDay", parsed.data.cycleAnchorDay, auth.viewer.id);
  await setSetting("payouts.holdingPeriodDays", parsed.data.holdingPeriodDays, auth.viewer.id);
  await setSetting("payouts.minimumPaise", Math.round(parsed.data.minimumRupees * 100), auth.viewer.id);
  await setSetting(
    "payouts.platformCommissionPercent",
    parsed.data.platformCommissionPercent,
    auth.viewer.id,
  );

  await recordAudit(prisma, {
    actorUserId: auth.viewer.id,
    action: AuditAction.PAYOUT_CONFIG_CHANGED,
    entityType: "SystemSetting",
    entityId: "payouts",
    metadata: {
      from: Object.fromEntries(previous.map((row) => [row.key, row.valueJson])),
      to: {
        "payouts.cycle": parsed.data.cycle,
        "payouts.cycleAnchorDay": parsed.data.cycleAnchorDay,
        "payouts.holdingPeriodDays": parsed.data.holdingPeriodDays,
        "payouts.minimumPaise": Math.round(parsed.data.minimumRupees * 100),
        "payouts.platformCommissionPercent": parsed.data.platformCommissionPercent,
      },
    },
  });

  revalidatePath("/admin/payouts/settings");
  revalidatePath("/admin/audit");
  return success("Payout rules updated. They apply to earnings settled from now on.");
}
