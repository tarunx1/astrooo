"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { INITIAL_ADMIN_STATE, type AdminActionState } from "@/lib/admin/action-state";

/**
 * Shared shell for a settings form.
 *
 * Wraps the existing form components rather than replacing them: the fields
 * themselves are the project's FormField, Input, Select and Textarea, so a
 * settings page looks and behaves like every other form here. This adds only
 * the parts every settings page repeats - pending state, the announced result
 * and the submit control - following the same feedback pattern the existing
 * admin forms use.
 */
export function SettingsForm({
  action,
  children,
  submitLabel = "Save changes",
  hiddenFields,
  onConfirm,
}: {
  action: (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  children: React.ReactNode;
  submitLabel?: string;
  hiddenFields?: Record<string, string>;
  /** Message to confirm before submitting, for changes worth pausing over. */
  onConfirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ADMIN_STATE);

  return (
    <form
      action={formAction}
      className="grid gap-5"
      onSubmit={(event) => {
        if (onConfirm && !window.confirm(onConfirm)) event.preventDefault();
      }}
    >
      {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}

      {children}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending} type="submit" variant="primary">
          {pending ? "Saving…" : submitLabel}
        </Button>

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
      </div>
    </form>
  );
}
