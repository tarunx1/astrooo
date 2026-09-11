"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { UserRole } from "@prisma/client";
import { changeUserRoleAction } from "@/app/admin/actions";
import { INITIAL_ADMIN_STATE } from "@/lib/admin/action-state";

/**
 * Role change.
 *
 * Disabled for the acting admin's own row, and the server refuses a self-change
 * regardless of what the browser submits — the actor always comes from the
 * session, never from a form field.
 */
export function RoleForm({
  targetUserId,
  currentRole,
  isSelf,
}: {
  targetUserId: string;
  currentRole: UserRole;
  isSelf: boolean;
}) {
  const [state, action] = useActionState(changeUserRoleAction, INITIAL_ADMIN_STATE);

  if (isSelf) {
    return <p className="caption text-foreground-muted">{currentRole} · your account</p>;
  }

  return (
    <form
      action={action}
      className="grid gap-1.5"
      onSubmit={(event) => {
        if (!window.confirm("Change this user's role? The change is recorded in the audit log.")) {
          event.preventDefault();
        }
      }}
    >
      <input name="targetUserId" type="hidden" value={targetUserId} />

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`role-${targetUserId}`}>
          Role
        </label>
        <select
          className="form-control"
          defaultValue={currentRole}
          id={`role-${targetUserId}`}
          name="role"
        >
          {Object.values(UserRole).map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <Submit />
      </div>

      <div aria-live="polite">
        {state.error ? (
          <p className="caption text-danger" role="alert">
            {state.error}
          </p>
        ) : state.ok && state.message ? (
          <p className="caption text-success" role="status">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Submit() {
  const status = useFormStatus();
  return (
    <button
      className="min-h-9 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold transition hover:bg-surface-hover disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
      disabled={status.pending}
      type="submit"
    >
      {status.pending ? "Saving..." : "Update"}
    </button>
  );
}
