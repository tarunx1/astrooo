"use client";

import { AdminField, AdminForm, adminInputClass } from "@/components/admin/admin-form";
import { SmoothInput } from "@/components/ui/smooth-input";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * Staff management forms.
 *
 * The permission picker offers only what a Super Admin may delegate. That is
 * presentation - `setEmployeePermissions` refuses an undelegable permission on
 * write, so the list here is a convenience, not the control.
 */
type Action = (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;

export function CreateEmployeeForm({ action }: { action: Action }) {
  return (
    <AdminForm action={action} pendingLabel="Adding..." submitLabel="Add to staff">
      {(state) => (
        <>
          <p className="rounded-md border border-slate-200 bg-slate-50 p-3 caption text-slate-600">
            The person signs up normally first. Adding them here grants the staff role and the default
            employee permissions - there is no invitation or second password to manage.
          </p>

          <AdminField error={state.fieldErrors.email?.[0]} label="Their account email" name="email">
            <SmoothInput className={adminInputClass} id="email" name="email" required type="email" />
          </AdminField>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Job title" name="jobTitle">
              <SmoothInput className={adminInputClass} id="jobTitle" name="jobTitle" />
            </AdminField>
            <AdminField label="Department" name="department">
              <SmoothInput className={adminInputClass} id="department" name="department" />
            </AdminField>
          </div>
        </>
      )}
    </AdminForm>
  );
}

export function EmployeeDetailsForm({
  action,
  targetUserId,
  defaults,
}: {
  action: Action;
  targetUserId: string;
  defaults: { jobTitle: string; department: string };
}) {
  return (
    <AdminForm action={action} pendingLabel="Saving..." submitLabel="Save" variant="secondary">
      <input name="targetUserId" type="hidden" value={targetUserId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="Job title" name="jobTitle">
          <SmoothInput className={adminInputClass} defaultValue={defaults.jobTitle} id="jobTitle" name="jobTitle" />
        </AdminField>
        <AdminField label="Department" name="department">
          <SmoothInput
            className={adminInputClass}
            defaultValue={defaults.department}
            id="department"
            name="department"
          />
        </AdminField>
      </div>
    </AdminForm>
  );
}

/**
 * The permission picker.
 *
 * Submits the complete desired set rather than a diff. A diff computed against
 * a page loaded ten minutes ago would silently restore a permission somebody
 * had just removed, which is the wrong way for an authorization screen to lose
 * a race.
 */
export function PermissionPicker({
  action,
  targetUserId,
  assignable,
  effective,
}: {
  action: Action;
  targetUserId: string;
  assignable: readonly Permission[];
  effective: readonly Permission[];
}) {
  const grouped = new Map<string, Permission[]>();
  for (const permission of assignable) {
    const group = permission.split(".")[0];
    grouped.set(group, [...(grouped.get(group) ?? []), permission]);
  }

  return (
    <AdminForm action={action} pendingLabel="Saving..." submitLabel="Save permissions">
      <input name="targetUserId" type="hidden" value={targetUserId} />

      <p className="rounded-md border border-slate-200 bg-slate-50 p-3 caption text-slate-600">
        Tick everything this person should have. What you save here is their complete set, so unticking
        removes. Credentials, commission, payout rules and staff management are not delegable and are
        refused even if submitted.
      </p>

      <div className="grid gap-4">
        {[...grouped.entries()].map(([group, permissions]) => (
          <fieldset className="grid gap-2" key={group}>
            <legend className="caption font-semibold uppercase tracking-wider text-slate-500">
              {group.replace(/_/g, " ")}
            </legend>
            <div className="grid gap-1.5">
              {permissions.map((permission) => (
                <label
                  className="flex cursor-pointer items-start gap-2.5 rounded-md border border-slate-200 bg-white p-2.5 transition hover:bg-slate-50 has-checked:border-blue-300 has-checked:bg-blue-50"
                  key={permission}
                >
                  <input
                    className="mt-0.5 size-4 accent-blue-600"
                    defaultChecked={effective.includes(permission)}
                    name="permissions"
                    type="checkbox"
                    value={permission}
                  />
                  <span className="grid">
                    <span className="body-sm font-medium text-slate-800">{PERMISSIONS[permission]}</span>
                    <span className="caption font-mono text-slate-400">{permission}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </AdminForm>
  );
}

export function EmployeeStatusForm({
  action,
  targetUserId,
  active,
}: {
  action: Action;
  targetUserId: string;
  active: boolean;
}) {
  return (
    <AdminForm
      action={action}
      confirm={
        active
          ? "Deactivate this employee? Their permissions stop applying on their next request."
          : undefined
      }
      pendingLabel="Saving..."
      submitLabel={active ? "Deactivate" : "Reactivate"}
      variant={active ? "danger" : "secondary"}
    >
      <input name="targetUserId" type="hidden" value={targetUserId} />
      <input name="active" type="hidden" value={active ? "false" : "true"} />
    </AdminForm>
  );
}
