"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import type { BirthDetailsFormState } from "@/app/kundli/actions";
import { submitBirthDetails } from "@/app/kundli/actions";
import type { LocationSuggestion } from "@/lib/kundli/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const birthDetailsInitialState: BirthDetailsFormState = {
  formErrors: [],
  fieldErrors: {},
};

/**
 * The canonical birth details form.
 *
 * It is reused verbatim by the free Kundli flow and by account birth-profile
 * create/edit. Only the submit target, button label, prefilled values and any
 * extra hidden fields vary; the fields, validation contract and location
 * resolution behaviour are shared so no second birth form can drift from this
 * one. All props are optional and the defaults reproduce the free Kundli flow
 * exactly.
 */
export type BirthDetailsFormDefaults = {
  name?: string;
  gender?: string;
  dateOfBirth?: string;
  timeOfBirth?: string;
  timeAccuracy?: string;
  place?: LocationSuggestion | null;
};

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
  const [query, setQuery] = useState(defaults?.place?.displayName ?? "");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [selected, setSelected] = useState<LocationSuggestion | null>(defaults?.place ?? null);
  const [timeAccuracy, setTimeAccuracy] = useState(defaults?.timeAccuracy ?? "EXACT");
  const placeListId = useId();

  useEffect(() => {
    if (query.trim().length < 2 || selected?.displayName === query) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetch(`/api/location/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { suggestions: [] }))
        .then((data: { suggestions: LocationSuggestion[] }) => setSuggestions(data.suggestions))
        .catch(() => setSuggestions([]));
    }, 160);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, selected?.displayName]);

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

      <FormRow error={fieldError("name")} label="Full Name" name="name">
        <Input
          autoComplete="name"
          defaultValue={defaults?.name}
          id="name"
          name="name"
          placeholder="Enter your full name"
          required
        />
      </FormRow>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow error={fieldError("dateOfBirth")} label="Date of Birth" name="dateOfBirth">
          <Input defaultValue={defaults?.dateOfBirth} id="dateOfBirth" name="dateOfBirth" required type="date" />
        </FormRow>
        <FormRow error={fieldError("gender")} label="Gender" name="gender">
          <Select defaultValue={defaults?.gender ?? ""} id="gender" name="gender">
            <option value="">Prefer not to say</option>
            <option>Female</option>
            <option>Male</option>
            <option>Non-binary</option>
          </Select>
        </FormRow>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_0.9fr]">
        <FormRow error={fieldError("timeOfBirth")} label="Time of Birth" name="timeOfBirth">
          <Input
            disabled={timeAccuracy === "UNKNOWN"}
            id="timeOfBirth"
            name="timeOfBirth"
            required
            type="time"
            defaultValue={defaults?.timeOfBirth ?? "12:00"}
          />
        </FormRow>
        <FormRow error={fieldError("timeAccuracy")} label="Time Accuracy" name="timeAccuracy">
          <Select id="timeAccuracy" name="timeAccuracy" onChange={(event) => setTimeAccuracy(event.target.value)} value={timeAccuracy}>
            <option value="EXACT">Exact</option>
            <option value="APPROXIMATE">Approximate</option>
            <option value="UNKNOWN">Unknown time</option>
          </Select>
        </FormRow>
      </div>

      <div className="relative">
        <FormRow error={fieldError("placeId")} label="Birth Place" name="place">
          <Input
            aria-autocomplete="list"
            aria-controls={placeListId}
            aria-expanded={suggestions.length > 0}
            autoComplete="off"
            id="place"
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
              if (event.target.value.trim().length < 2) setSuggestions([]);
            }}
            placeholder="Search city, state, country"
            required
            role="combobox"
            value={query}
          />
        </FormRow>
        {suggestions.length ? (
          <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-[var(--shadow-lg)]" id={placeListId} role="listbox">
            {suggestions.map((suggestion) => (
              <button
                className="block w-full border-b border-border px-4 py-3 text-left body-sm text-foreground transition last:border-b-0 hover:bg-surface-hover"
                aria-selected={selected?.placeId === suggestion.placeId}
                key={suggestion.placeId}
                onClick={() => {
                  setSelected(suggestion);
                  setQuery(suggestion.displayName);
                  setSuggestions([]);
                }}
                role="option"
                type="button"
              >
                <span className="block font-semibold">{suggestion.city}</span>
                <span className="text-foreground-muted">{suggestion.displayName}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <input name="placeId" type="hidden" value={selected?.placeId ?? ""} />
      <input name="displayName" type="hidden" value={selected?.displayName ?? ""} />
      <input name="city" type="hidden" value={selected?.city ?? ""} />
      <input name="region" type="hidden" value={selected?.region ?? ""} />
      <input name="country" type="hidden" value={selected?.country ?? ""} />

      <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
    </form>
  );
}

function FormRow({ children, error, label, name }: { children: React.ReactNode; error?: string; label: string; name: string }) {
  return (
    <label className="grid gap-2 caption text-foreground-secondary" htmlFor={name}>
      {label}
      {children}
      {error ? <span className="body-sm text-danger">{error}</span> : null}
    </label>
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
