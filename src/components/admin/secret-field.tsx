"use client";

import { useActionState } from "react";
import { removeSecretAction, replaceSecretAction } from "@/app/admin/settings/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { INITIAL_ADMIN_STATE } from "@/lib/admin/action-state";
import { cn } from "@/lib/utils";

/**
 * A stored credential.
 *
 * Write-only by construction. The component is never given the value - the
 * server sends only whether one exists and where it came from - so there is
 * nothing here to reveal, copy or accidentally render. Leaving the field blank
 * keeps the current value, so a page can be re-saved without retyping secrets.
 */
export function SecretField({
  secretKey,
  label,
  hint,
  configured,
  source,
}: {
  secretKey: string;
  label: string;
  hint?: string;
  configured: boolean;
  source: "admin" | "environment" | "none";
}) {
  const [replaceState, replace, replacing] = useActionState(replaceSecretAction, INITIAL_ADMIN_STATE);
  const [removeState, remove, removing] = useActionState(removeSecretAction, INITIAL_ADMIN_STATE);

  const state = replaceState.error || replaceState.message ? replaceState : removeState;
  const inputId = `secret-${secretKey}`;

  return (
    <div className="grid gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="body-sm font-semibold text-foreground">{label}</span>
        {/*
          Rendered here rather than imported from the admin shell: this is a
          client component, and importing that module would pull its
          server-only dependencies into the browser bundle. The status is
          carried by the text, not by colour alone.
        */}
        <span
          className={cn(
            "inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            configured ? "border-success/40 text-success" : "border-border-strong text-foreground-muted",
          )}
        >
          {!configured ? "Not configured" : source === "environment" ? "Set in environment" : "Configured"}
        </span>
      </div>

      <form action={replace} className="grid gap-3">
        <input name="key" type="hidden" value={secretKey} />

        <FormField
          hint={hint ?? (configured ? "Leave blank to keep the current value." : undefined)}
          id={inputId}
          label={configured ? "Replacement value" : "Value"}
        >
          <Input
            autoComplete="off"
            id={inputId}
            name="value"
            placeholder={configured ? "••••••••" : ""}
            type="password"
          />
        </FormField>

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={replacing} size="sm" type="submit" variant="secondary">
            {replacing ? "Saving…" : configured ? "Replace" : "Save"}
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

      {configured && source === "admin" ? (
        <form
          action={remove}
          onSubmit={(event) => {
            if (!window.confirm(`Remove ${label}? The provider will fall back to the environment, if one is set.`)) {
              event.preventDefault();
            }
          }}
        >
          <input name="key" type="hidden" value={secretKey} />
          <Button disabled={removing} size="sm" type="submit" variant="ghost">
            {removing ? "Removing…" : "Remove"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
