"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { BirthDetailsFormState } from "@/app/kundli/actions";
import { submitBirthDetails } from "@/app/kundli/actions";
import { Button } from "@/components/ui/button";
import { BirthDetailsFields, type BirthDetailsFieldDefaults } from "@/components/kundli/birth-details-fields";
import { cn } from "@/lib/utils";

const birthDetailsInitialState: BirthDetailsFormState = {
  formErrors: [],
  fieldErrors: {},
};

/**
 * The canonical birth details form.
 *
 * The fields themselves live in `BirthDetailsFields` so that pages needing two
 * people in one submission compose the same definitions rather than restating
 * them. This component owns the `<form>`, the action wiring and the submit
 * button; the free Kundli flow and account birth-profile create/edit all use it
 * with different actions and labels only.
 */
export type BirthDetailsFormDefaults = BirthDetailsFieldDefaults;

type BirthDetailsFormProps = {
  action?: (state: BirthDetailsFormState, formData: FormData) => Promise<BirthDetailsFormState>;
  submitLabel?: string;
  pendingLabel?: string;
  defaults?: BirthDetailsFormDefaults;
  hiddenFields?: Record<string, string>;
  compact?: boolean;
};

export function BirthDetailsForm({
  action: formAction = submitBirthDetails,
  submitLabel = "Generate Free Janam Kundli",
  pendingLabel = "Calculating planetary positions...",
  defaults,
  hiddenFields,
  compact = false,
}: BirthDetailsFormProps = {}) {
  const [state, action] = useActionState<BirthDetailsFormState, FormData>(formAction, birthDetailsInitialState);
  const safeState = state ?? birthDetailsInitialState;

  const fieldError = (field: string) => safeState.fieldErrors[field]?.[0];

  return (
    <form action={action} className={cn("grid", compact ? "gap-3.5" : "gap-5")} noValidate>
      {safeState.formErrors.length ? (
        <div className="rounded-md border border-danger/50 bg-background p-4 body-sm text-danger" role="alert">
          {safeState.formErrors.join(" ")}
        </div>
      ) : null}

      {hiddenFields
        ? Object.entries(hiddenFields).map(([key, value]) => <input key={key} name={key} type="hidden" value={value} />)
        : null}

      <BirthDetailsFields compact={compact} defaults={defaults} fieldError={fieldError} />

      <SubmitButton compact={compact} label={submitLabel} pendingLabel={pendingLabel} />
    </form>
  );
}

function SubmitButton({ compact, label, pendingLabel }: { compact: boolean; label: string; pendingLabel: string }) {
  const status = useFormStatus();
  return (
    <Button
      className={cn(
        "w-full",
        compact && "mt-1 min-h-[46px] rounded-[12px] py-2.5 text-sm shadow-[0_10px_28px_rgb(214_181_109/0.18)] hover:-translate-y-0.5 hover:opacity-100 active:translate-y-0 active:scale-[0.99]",
      )}
      size={compact ? "md" : "lg"}
      type="submit"
      variant="premium"
    >
      {status.pending ? pendingLabel : label}
    </Button>
  );
}
