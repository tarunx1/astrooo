"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeSuperAdmin } from "@/lib/auth/access";
import {
  createEmployee,
  employeeInputSchema,
  setEmployeeActive,
  setEmployeePermissions,
  updateEmployee,
} from "@/lib/admin/employees";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * Staff management Server Actions.
 *
 * Every one requires SUPER_ADMIN rather than a permission. That is the point of
 * the control: an employee who could re-permission employees could give
 * themselves anything, so the capability is held by the owner and is not in the
 * delegable set at all - `employees.manage` appears in
 * `SUPER_ADMIN_ONLY_PERMISSIONS` and is refused on write if someone tries to
 * hand it out.
 */
const idSchema = z.string().trim().min(1).max(64);

function denied(reason?: string): AdminActionState {
  return { ok: false, error: reason ?? "You are not authorised to perform this action.", fieldErrors: {} };
}

function failure(
  error: string,
  fieldErrors: Record<string, string[]> = {},
  formData?: FormData,
): AdminActionState {
  const values: Record<string, string> = {};
  if (formData) {
    for (const [name, value] of formData.entries()) {
      if (typeof value === "string") values[name] = value;
    }
  }
  return { ok: false, error, fieldErrors, values: formData ? values : undefined };
}

function success(message: string): AdminActionState {
  return { ok: true, error: null, message, fieldErrors: {} };
}

export async function createEmployeeAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return denied(auth.error);

  const parsed = employeeInputSchema.safeParse({
    email: formData.get("email"),
    jobTitle: (formData.get("jobTitle") as string)?.trim() || null,
    department: (formData.get("department") as string)?.trim() || null,
  });

  if (!parsed.success) {
    return failure("Check the details below.", z.flattenError(parsed.error).fieldErrors, formData);
  }

  const result = await createEmployee({
    actorUserId: auth.viewer.id,
    email: parsed.data.email,
    jobTitle: parsed.data.jobTitle,
    department: parsed.data.department,
  });

  if (!result.ok) return failure(result.message, {}, formData);

  revalidatePath("/admin/employees");
  revalidatePath("/admin/audit");
  return success("Added to staff with the default employee permissions.");
}

export async function updateEmployeeAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return denied(auth.error);

  const parsed = z
    .object({
      targetUserId: idSchema,
      jobTitle: z.string().trim().max(120).nullable(),
      department: z.string().trim().max(120).nullable(),
    })
    .safeParse({
      targetUserId: formData.get("targetUserId"),
      jobTitle: (formData.get("jobTitle") as string)?.trim() || null,
      department: (formData.get("department") as string)?.trim() || null,
    });

  if (!parsed.success) return failure("Check the details below.", {}, formData);

  const result = await updateEmployee({ actorUserId: auth.viewer.id, ...parsed.data });
  if (!result.ok) return failure(result.message, {}, formData);

  revalidatePath("/admin/employees");
  revalidatePath(`/admin/employees/${parsed.data.targetUserId}`);
  return success("Saved.");
}

export async function setEmployeeActiveAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return denied(auth.error);

  const parsed = z
    .object({ targetUserId: idSchema, active: z.boolean() })
    .safeParse({
      targetUserId: formData.get("targetUserId"),
      active: formData.get("active") === "true",
    });

  if (!parsed.success) return failure("That request is not recognised.");

  const result = await setEmployeeActive({ actorUserId: auth.viewer.id, ...parsed.data });
  if (!result.ok) return failure(result.message);

  revalidatePath("/admin/employees");
  revalidatePath(`/admin/employees/${parsed.data.targetUserId}`);
  revalidatePath("/admin/audit");
  return success(parsed.data.active ? "Reactivated." : "Deactivated. Their permissions no longer apply.");
}

/**
 * Replaces one employee's permission set.
 *
 * The form submits the whole desired set, not a diff: applying a diff computed
 * against a page loaded ten minutes ago would silently restore a permission
 * somebody had just removed.
 */
export async function setEmployeePermissionsAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return denied(auth.error);

  const targetUserId = formData.get("targetUserId");
  if (typeof targetUserId !== "string" || !targetUserId) {
    return failure("That employee is not recognised.");
  }

  const permissions = formData
    .getAll("permissions")
    .filter((value): value is string => typeof value === "string");

  const result = await setEmployeePermissions({
    actorUserId: auth.viewer.id,
    targetUserId,
    permissions,
  });

  if (!result.ok) return failure(result.message);

  revalidatePath("/admin/employees");
  revalidatePath(`/admin/employees/${targetUserId}`);
  revalidatePath("/admin/audit");
  return success("Permissions updated. They take effect on their next request.");
}
