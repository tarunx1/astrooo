"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { z } from "zod";
import { authorizeSuperAdminAction } from "@/lib/auth/admin";
import { recordAudit } from "@/lib/admin/audit";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/observability/logger";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import { SECRETS, SETTINGS, isSecretKey, type SecretKey, type SettingKey } from "@/lib/settings/registry";
import { removeSecret, setSecret, setSetting } from "@/lib/settings/service";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * System settings mutations.
 *
 * Every action here re-authorizes as SUPER_ADMIN server-side. The navigation
 * hides these pages from an ordinary admin, but hiding is not a control: a
 * crafted POST reaches the same code, so the check lives here.
 *
 * Secrets are write-only throughout. Nothing in this file reads a stored
 * credential back, and nothing returns one to a caller.
 */
function denied(reason?: string): AdminActionState {
  return { ok: false, error: reason ?? "You are not authorised to perform this action.", fieldErrors: {} };
}

function failure(error: string, fieldErrors: Record<string, string[]> = {}): AdminActionState {
  return { ok: false, error, fieldErrors };
}

function success(message: string): AdminActionState {
  return { ok: true, error: null, message, fieldErrors: {} };
}

/** Revalidates every surface a settings change can reach. */
function revalidateAffected(paths: string[]) {
  for (const path of ["/admin/settings", ...paths]) revalidatePath(path);
}

/* ------------------------------------------------------------------ */
/* Non-secret settings                                                 */
/* ------------------------------------------------------------------ */

/** Coerces a form value to the shape the registry schema expects. */
function readFormValue(key: SettingKey, formData: FormData): unknown {
  const schema = SETTINGS[key].schema;
  const raw = formData.get(key);

  // A checkbox that is off sends nothing at all.
  if (schema instanceof z.ZodBoolean) return raw === "on" || raw === "true";
  if (schema instanceof z.ZodNumber) return raw === null || raw === "" ? undefined : Number(raw);

  return raw === null ? "" : String(raw);
}

/**
 * Saves a group of settings belonging to one page.
 *
 * The keys are supplied by the page rather than the browser, so a crafted form
 * cannot reach a setting from another category.
 */
export async function saveSettingsGroup(
  keys: readonly SettingKey[],
  formData: FormData,
  paths: string[],
): Promise<AdminActionState> {
  const auth = await authorizeSuperAdminAction();
  if (!auth.ok) return denied(auth.error);

  const changes: Array<{ key: string; to: unknown }> = [];

  try {
    for (const key of keys) {
      const written = await setSetting(key, readFormValue(key, formData), auth.admin.id);
      changes.push({ key, to: written });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return failure("Some values were not valid.", { form: error.issues.map((issue) => issue.message) });
    }
    logger.error("settings_save_failed", { error });
    return failure("That could not be saved.");
  }

  await recordAudit(prisma, {
    actorUserId: auth.admin.id,
    action: AuditAction.SYSTEM_SETTING_UPDATED,
    entityType: "SystemSetting",
    entityId: keys.join(","),
    // Non-secret values only: everything in SETTINGS is safe to record.
    metadata: { changes },
  });

  revalidateAffected(paths);
  return success("Settings saved.");
}

/* ------------------------------------------------------------------ */
/* Secrets                                                             */
/* ------------------------------------------------------------------ */

/**
 * Replaces one credential.
 *
 * A blank field means "keep what is there", which is what makes it safe to
 * re-save a page without retyping every secret. Clearing one is a separate,
 * explicit action.
 */
export async function replaceSecretAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeSuperAdminAction();
  if (!auth.ok) return denied(auth.error);

  const key = String(formData.get("key") ?? "");
  if (!isSecretKey(key)) return failure("Unknown credential.");

  const value = String(formData.get("value") ?? "");
  if (!value.trim()) return failure("Enter the new value, or use Remove to clear it.");

  // Rotation is rare and expensive to get wrong, so it is limited separately
  // and far more tightly than ordinary settings edits.
  const decision = await checkRateLimit({
    namespace: "admin:secret-replace",
    identifier: `admin:${auth.admin.id}`,
  });
  if (!decision.allowed) return failure(rateLimitMessage(decision.retryAfterSeconds));

  try {
    await setSecret(key as SecretKey, value, auth.admin.id);
  } catch (error) {
    // The message may name the missing encryption key but never the value.
    logger.error("secret_replace_failed", { key, error });
    return failure(
      error instanceof Error && error.message.includes("CONFIG_ENCRYPTION_KEY")
        ? "Encryption is not configured on this deployment, so credentials cannot be stored."
        : "That credential could not be saved.",
    );
  }

  await recordAudit(prisma, {
    actorUserId: auth.admin.id,
    action: AuditAction.SYSTEM_SECRET_REPLACED,
    entityType: "SystemSecret",
    entityId: key,
    // Never the value, the ciphertext or any part of the envelope.
    metadata: { key, changed: true },
  });

  revalidateAffected(["/admin/settings/payments", "/admin/settings/ai", "/admin/settings/astrology"]);
  return success(`${SECRETS[key as SecretKey].label} replaced.`);
}

/** Clears a stored credential, falling the provider back to the environment. */
export async function removeSecretAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeSuperAdminAction();
  if (!auth.ok) return denied(auth.error);

  const key = String(formData.get("key") ?? "");
  if (!isSecretKey(key)) return failure("Unknown credential.");

  await removeSecret(key as SecretKey);

  await recordAudit(prisma, {
    actorUserId: auth.admin.id,
    action: AuditAction.SYSTEM_SECRET_REMOVED,
    entityType: "SystemSecret",
    entityId: key,
    metadata: { key, changed: true },
  });

  revalidateAffected(["/admin/settings/payments", "/admin/settings/ai", "/admin/settings/astrology"]);
  return success(`${SECRETS[key as SecretKey].label} removed.`);
}
