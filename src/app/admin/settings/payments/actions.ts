"use server";

import { AuditAction } from "@prisma/client";
import { saveSettingsGroup } from "@/app/admin/settings/actions";
import { recordAudit } from "@/lib/admin/audit";
import { authorizeSuperAdminAction } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { getSetting } from "@/lib/settings/service";
import type { AdminActionState } from "@/lib/admin/action-state";
import type { SettingKey } from "@/lib/settings/registry";

const PAYMENT_KEYS = [
  "payments.enabled",
  "payments.mode",
  "payments.razorpayKeyId",
] as const satisfies readonly SettingKey[];

/**
 * Saves payment configuration.
 *
 * Moving to LIVE is recorded as its own audit event rather than being folded
 * into a generic settings update: it is the point at which real money can be
 * taken, and it should be findable in the log without reading every change.
 */
export async function savePaymentSettingsAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeSuperAdminAction();
  if (!auth.ok) {
    return { ok: false, error: auth.error, fieldErrors: {} };
  }

  const previousMode = await getSetting("payments.mode");
  const result = await saveSettingsGroup(PAYMENT_KEYS, formData, ["/admin/settings/payments"]);
  if (!result.ok) return result;

  const nextMode = await getSetting("payments.mode");

  if (nextMode !== previousMode) {
    await recordAudit(prisma, {
      actorUserId: auth.admin.id,
      action: AuditAction.PAYMENT_MODE_CHANGED,
      entityType: "SystemSetting",
      entityId: "payments.mode",
      metadata: { from: previousMode, to: nextMode },
    });
  }

  return result;
}
