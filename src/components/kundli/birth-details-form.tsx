"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { BirthDetailsFormState } from "@/app/kundli/actions";
import { submitBirthDetails } from "@/app/kundli/actions";
import { Button } from "@/components/ui/button";
import { BirthDetailsFields, type BirthDetailsFieldDefaults } from "@/components/kundli/birth-details-fields";

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
};

export function BirthDetailsForm({
  action: formAction = submitBirthDetails,
  submitLabel = "Generate Free Janam Kundli",
  pendingLabel = "Calculating planetary positions...",
  defaults,
  hiddenFields,
}: BirthDetailsFormProps = {}) {
  const [state, action] = useActionState<BirthDetailsFormState, FormData>(formAction, birthDetailsInitialState);
  const safeState = state ?? birthDetailsInitialState;

  const fieldError = (field: string) => safeState.fieldErrors[field]?.[0];

  return (
    <form action={action} className="grid gap-5" noValidate>
      {safeState.formErrors.length ? (
        <div className="rounded-md border border-danger/50 bg-background p-4 body-sm text-danger" role="alert">
          {safeState.formErrors.join(" ")}
        </div>
      ) : null}

      {hiddenFields
        ? Object.entries(hiddenFields).map(([key, value]) => <input key={key} name={key} type="hidden" value={value} />)
        : null}

      <BirthDetailsFields defaults={defaults} fieldError={fieldError} />

      <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
    </form>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const status = useFormStatus();
  return (
    <Button className="mt-2 w-full" size="lg" type="submit" variant="premium">
      {status.pending ? pendingLabel : label}
    </Button>
  );
}
