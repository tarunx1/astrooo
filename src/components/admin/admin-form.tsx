"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { INITIAL_ADMIN_STATE, type AdminActionState } from "@/lib/admin/action-state";

/**
 * Wrapper for admin mutations.
 *
 * Surfaces the server's outcome verbatim in a live region. It never optimistically
 * reports success: the message shown is the one the server returned after the
 * write committed.
 */
export function AdminForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  variant = "primary",
  confirm,
}: {
  action: (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  children: React.ReactNode | ((state: AdminActionState) => React.ReactNode);
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ADMIN_STATE);

  return (
    <form
      action={formAction}
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {typeof children === "function" ? children(state) : children}

      <div aria-live="polite">
        {state.error ? (
          <p className="rounded-md border border-danger/50 bg-background p-3 body-sm text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.ok && state.message ? (
          <p className="rounded-md border border-success/50 bg-background p-3 body-sm text-success" role="status">
            {state.message}
          </p>
        ) : null}
      </div>

      <Submit label={submitLabel} pendingLabel={pendingLabel} variant={variant} />
    </form>
  );
}

function Submit({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel?: string;
  variant: "primary" | "secondary" | "danger";
}) {
  const status = useFormStatus();
  return (
    <Button className="w-full sm:w-auto" type="submit" variant={variant}>
      {status.pending ? (pendingLabel ?? "Saving...") : label}
    </Button>
  );
}

export function AdminField({
  label,
  name,
  children,
  hint,
  error,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="caption text-foreground-secondary" htmlFor={name}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="caption text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="caption text-foreground-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const adminInputClass =
  "min-h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan";
