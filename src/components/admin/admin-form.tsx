"use client";

import { FormField } from "@/components/ui/form-field";
import { useActionState, useEffect, useRef } from "react";
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
  const formRef = useRef<HTMLFormElement | null>(null);

  /**
   * Puts back what was typed after a rejected submit.
   *
   * React clears a form once its action resolves, which is right after a
   * success and wrong after a failure: the operator was left with validation
   * errors pointing at fields that had just been emptied. The server returns
   * the submitted values with the failure and they are written back here.
   *
   * Restoring rather than making every field controlled keeps the forms as
   * plain uncontrolled inputs, which is what the rest of them rely on.
   */
  useEffect(() => {
    const form = formRef.current;
    const values = state.values;
    if (!form || state.ok || !values) return;

    for (const element of Array.from(form.elements)) {
      if (!(element instanceof HTMLInputElement
        || element instanceof HTMLTextAreaElement
        || element instanceof HTMLSelectElement)) continue;
      if (!element.name || element.type === "file" || element.type === "submit") continue;

      if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
        // An unticked box sends nothing at all, so presence is the state.
        element.checked = element.type === "checkbox"
          ? Object.hasOwn(values, element.name)
          : values[element.name] === element.value;
        continue;
      }

      const value = values[element.name];
      if (value !== undefined) element.value = value;
    }
  }, [state]);

  return (
    <form
      action={formAction}
      className="grid gap-4"
      noValidate
      ref={formRef}
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
    <FormField error={error} id={name} label={label} hint={hint}>
      {children}
    </FormField>
  );
}

export const adminInputClass = "form-control";
