"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, PanditDocumentStatus, PanditOnboardingStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { authorizeAction, authorizeSuperAdmin } from "@/lib/auth/access";
import { recordAudit } from "@/lib/admin/audit";
import { applyTransition } from "@/lib/pandit/service";
import { reviewDocument } from "@/lib/pandit/documents";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * Pandit review Server Actions.
 *
 * Shared by `/admin` and `/employee` rather than duplicated: an action is a
 * function whose authorization lives inside it, so which dashboard the form was
 * rendered on has no bearing on what it permits. Duplicating them per area
 * would mean two gates to keep in step.
 *
 * The permission each one needs is passed explicitly, so the transitions map
 * onto the delegation model: an employee with `pandits.review` can start a
 * review and ask for corrections, `pandits.verify` is needed to verify, and
 * final approval and suspension are `pandits.approve` and `pandits.suspend` -
 * neither of which is in the default employee bundle.
 */
const idSchema = z.string().trim().min(1).max(64);
const noteSchema = z.string().trim().max(1_000);

function denied(reason?: string): AdminActionState {
  return { ok: false, error: reason ?? "You are not authorised to perform this action.", fieldErrors: {} };
}

function failure(error: string): AdminActionState {
  return { ok: false, error, fieldErrors: {} };
}

function success(message: string): AdminActionState {
  return { ok: true, error: null, message, fieldErrors: {} };
}

function revalidatePandit(panditProfileId: string): void {
  revalidatePath("/admin/pandits");
  revalidatePath("/admin/pandits/applications");
  revalidatePath("/admin/pandits/verification");
  revalidatePath(`/admin/pandits/${panditProfileId}`);
  revalidatePath("/employee/pandits");
  revalidatePath("/employee/verification");
  revalidatePath(`/employee/pandits/${panditProfileId}`);
  revalidatePath("/pandit");
  revalidatePath("/pandit/verification");
}

/**
 * One reviewer decision.
 *
 * The target status arrives from the form, but it is never trusted as a
 * destination: `applyTransition` re-reads the current status inside its own
 * transaction and refuses any move the declared table does not contain. This
 * action's job is to establish *who* is acting and with what authority.
 */
export async function reviewPanditAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = z
    .object({
      panditProfileId: idSchema,
      to: z.nativeEnum(PanditOnboardingStatus),
      note: noteSchema.optional(),
    })
    .safeParse({
      panditProfileId: formData.get("panditProfileId"),
      to: formData.get("to"),
      note: formData.get("note") ?? undefined,
    });

  if (!parsed.success) return failure("That decision is not recognised.");

  // Which permission this decision needs. Chosen from the destination, on the
  // server, so a form cannot ask for an approval while presenting itself as a
  // review.
  const permission =
    parsed.data.to === PanditOnboardingStatus.VERIFIED
      ? "pandits.verify"
      : parsed.data.to === PanditOnboardingStatus.APPROVED
        ? "pandits.approve"
        : parsed.data.to === PanditOnboardingStatus.SUSPENDED
          ? "pandits.suspend"
          : parsed.data.to === PanditOnboardingStatus.ACTIVE
            ? "pandits.suspend"
            : parsed.data.to === PanditOnboardingStatus.REJECTED
              ? "pandits.approve"
              : "pandits.review";

  const auth = await authorizeAction(permission);
  if (!auth.ok) return denied(auth.error);

  // A reviewer acts as "reviewer"; approving and suspending additionally
  // require the approver kind, which `applyTransition` checks against the rule.
  const actorKind =
    permission === "pandits.approve" || permission === "pandits.suspend" ? "approver" : "reviewer";

  if (
    (parsed.data.to === PanditOnboardingStatus.CHANGES_REQUESTED ||
      parsed.data.to === PanditOnboardingStatus.REJECTED ||
      parsed.data.to === PanditOnboardingStatus.SUSPENDED) &&
    !parsed.data.note?.trim()
  ) {
    return failure("Say why, so the applicant knows what to do next.");
  }

  const result = await applyTransition({
    panditProfileId: parsed.data.panditProfileId,
    to: parsed.data.to,
    actorUserId: auth.viewer.id,
    actorKind,
    note: parsed.data.note ?? null,
  });

  if (!result.ok) return failure(result.message);

  revalidatePandit(parsed.data.panditProfileId);
  revalidatePath("/admin/audit");
  return success("Decision recorded.");
}

export async function reviewPanditDocumentAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeAction("pandits.review");
  if (!auth.ok) return denied(auth.error);

  const parsed = z
    .object({
      documentId: idSchema,
      panditProfileId: idSchema,
      status: z.nativeEnum(PanditDocumentStatus),
      rejectionReason: noteSchema.optional(),
    })
    .safeParse({
      documentId: formData.get("documentId"),
      panditProfileId: formData.get("panditProfileId"),
      status: formData.get("status"),
      rejectionReason: formData.get("rejectionReason") ?? undefined,
    });

  if (!parsed.success) return failure("That document decision is not recognised.");

  const result = await reviewDocument({
    documentId: parsed.data.documentId,
    reviewerUserId: auth.viewer.id,
    status: parsed.data.status,
    rejectionReason: parsed.data.rejectionReason ?? null,
  });

  if (!result.ok) return failure(result.message);

  revalidatePandit(parsed.data.panditProfileId);
  return success("Document reviewed.");
}

/**
 * Sets a Pandit's commission override.
 *
 * Super Admin only, and deliberately not delegable: commission decides how a
 * consultation is split, which makes it a money rule rather than an operational
 * task. Existing earnings are untouched - each one carries the percentage it
 * was settled at.
 */
export async function setPanditCommissionAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return denied(auth.error);

  const raw = formData.get("commissionPercent");
  const parsed = z
    .object({
      panditProfileId: idSchema,
      commissionPercent: z.number().int().min(0).max(90).nullable(),
    })
    .safeParse({
      panditProfileId: formData.get("panditProfileId"),
      commissionPercent:
        typeof raw === "string" && raw.trim() !== "" ? Number(raw) : null,
    });

  if (!parsed.success) return failure("Commission must be a whole percentage between 0 and 90.");

  const profile = await prisma.panditProfile.findUnique({
    where: { id: parsed.data.panditProfileId },
    select: { id: true, commissionPercent: true },
  });

  if (!profile) return failure("That Pandit could not be found.");

  await prisma.$transaction(async (tx) => {
    await tx.panditProfile.update({
      where: { id: profile.id },
      data: { commissionPercent: parsed.data.commissionPercent },
    });

    await recordAudit(tx, {
      actorUserId: auth.viewer.id,
      action: AuditAction.PANDIT_COMMISSION_CHANGED,
      entityType: "PanditProfile",
      entityId: profile.id,
      metadata: { from: profile.commissionPercent, to: parsed.data.commissionPercent },
    });
  });

  revalidatePandit(profile.id);
  revalidatePath("/admin/audit");
  return success(
    parsed.data.commissionPercent === null
      ? "Commission override removed. The platform default applies."
      : `Commission set to ${parsed.data.commissionPercent}% for future earnings.`,
  );
}
