"use client";

import { useEffect, useId, useState } from "react";
import type { LocationSuggestion } from "@/lib/kundli/types";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * The canonical birth-details field set.
 *
 * Extracted from `BirthDetailsForm` so pages needing two people in one
 * submission (Kundli matching) compose the same fields rather than restating
 * them. `BirthDetailsForm` renders exactly this inside its own `<form>`, so
 * there is still a single definition of what birth details are and how a place
 * is resolved.
 *
 * `prefix` namespaces the field names: with `prefix="a"` the inputs become
 * `aName`, `aDateOfBirth` and so on, letting one form carry two people.
 */
export type BirthDetailsFieldDefaults = {
  name?: string;
  gender?: string;
  dateOfBirth?: string;
  timeOfBirth?: string;
  timeAccuracy?: string;
  place?: LocationSuggestion | null;
};

function fieldName(prefix: string, base: string): string {
  return prefix ? `${prefix}${base.charAt(0).toUpperCase()}${base.slice(1)}` : base;
}

const COMPACT_FORM_FIELD_CLASS = "gap-1.5";

export function BirthDetailsFields({
  prefix = "",
  defaults,
  fieldError,
  nameLabel = "Full Name",
  compact = false,
}: {
  prefix?: string;
  defaults?: BirthDetailsFieldDefaults;
  fieldError?: (field: string) => string | undefined;
  nameLabel?: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState(defaults?.place?.displayName ?? "");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [selected, setSelected] = useState<LocationSuggestion | null>(defaults?.place ?? null);
  const [timeAccuracy, setTimeAccuracy] = useState(defaults?.timeAccuracy ?? "EXACT");
  const placeListId = useId();
  const uid = useId();

  useEffect(() => {
    if (query.trim().length < 2 || selected?.displayName === query) return;

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

  const error = (field: string) => fieldError?.(fieldName(prefix, field));
  const id = (base: string) => `${uid}-${fieldName(prefix, base)}`;
  const compactControlClass =
    "min-h-[52px] rounded-[12px] border-border/70 bg-background/50 px-3.5 py-2.5 text-sm placeholder:text-foreground-muted/85 hover:border-premium/45 focus:border-premium focus:outline-premium/35 focus-visible:border-premium focus-visible:outline-premium/35";
  const sectionClass = cn("form-section", compact && "gap-2.5");
  const sectionTitleClass = cn(
    "form-section-title",
    compact && "text-[0.82rem] font-semibold leading-tight text-foreground/90",
  );
  const gridGapClass = compact ? "gap-2.5 sm:gap-3" : "gap-4";

  return (
    <>
      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Birth details</h3>
        <FormRow compact={compact} error={error("name")} htmlFor={id("name")} label={nameLabel}>
          <Input
            autoComplete="name"
            className={compact ? compactControlClass : undefined}
            defaultValue={defaults?.name}
            id={id("name")}
            name={fieldName(prefix, "name")}
            placeholder="Enter full name"
            required
          />
        </FormRow>

        <div className={cn("grid sm:grid-cols-2", gridGapClass)}>
          <FormRow compact={compact} error={error("dateOfBirth")} htmlFor={id("dateOfBirth")} label="Date of Birth">
            <Input
              className={compact ? compactControlClass : undefined}
              defaultValue={defaults?.dateOfBirth}
              id={id("dateOfBirth")}
              name={fieldName(prefix, "dateOfBirth")}
              required
              type="date"
            />
          </FormRow>
          <FormRow compact={compact} error={error("gender")} htmlFor={id("gender")} label="Gender">
            <Select className={compact ? compactControlClass : undefined} defaultValue={defaults?.gender ?? ""} id={id("gender")} name={fieldName(prefix, "gender")}>
              <option value="">Prefer not to say</option>
              <option>Female</option>
              <option>Male</option>
              <option>Non-binary</option>
            </Select>
          </FormRow>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>Time accuracy</h3>
        <div className={cn("grid sm:grid-cols-[1fr_0.9fr]", gridGapClass)}>
          <FormRow compact={compact} error={error("timeOfBirth")} htmlFor={id("timeOfBirth")} label="Time of Birth">
            <Input
              className={compact ? compactControlClass : undefined}
              defaultValue={defaults?.timeOfBirth ?? "12:00"}
              disabled={timeAccuracy === "UNKNOWN"}
              id={id("timeOfBirth")}
              name={fieldName(prefix, "timeOfBirth")}
              required
              type="time"
            />
            {timeAccuracy === "UNKNOWN" ? (
              <input name={fieldName(prefix, "timeOfBirth")} type="hidden" value="12:00" />
            ) : null}
          </FormRow>
          <FormRow compact={compact} error={error("timeAccuracy")} htmlFor={id("timeAccuracy")} label="Time accuracy">
            <Select
              className={compact ? compactControlClass : undefined}
              id={id("timeAccuracy")}
              name={fieldName(prefix, "timeAccuracy")}
              onChange={(event) => setTimeAccuracy(event.target.value)}
              value={timeAccuracy}
            >
              <option value="EXACT">Exact</option>
              <option value="APPROXIMATE">Approximate</option>
              <option value="UNKNOWN">Unknown time</option>
            </Select>
          </FormRow>
        </div>
      </div>

      <div className={cn(sectionClass, "relative")}>
        <h3 className={sectionTitleClass}>Birth location</h3>
        <FormRow compact={compact} error={error("placeId")} htmlFor={id("place")} label="Birth Place">
          <Input
            aria-autocomplete="list"
            aria-controls={placeListId}
            aria-expanded={suggestions.length > 0}
            autoComplete="off"
            className={compact ? compactControlClass : undefined}
            id={id("place")}
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
          <div
            className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-[10px] border border-border bg-surface shadow-[var(--shadow-lg)]"
            id={placeListId}
            role="listbox"
          >
            {suggestions.map((suggestion) => (
              <button
                aria-selected={selected?.placeId === suggestion.placeId}
                className="block w-full border-b border-border px-4 py-3 text-left body-sm text-foreground transition last:border-b-0 hover:bg-surface-hover"
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

      <input name={fieldName(prefix, "placeId")} type="hidden" value={selected?.placeId ?? ""} />
      <input name={fieldName(prefix, "displayName")} type="hidden" value={selected?.displayName ?? ""} />
      <input name={fieldName(prefix, "city")} type="hidden" value={selected?.city ?? ""} />
      <input name={fieldName(prefix, "region")} type="hidden" value={selected?.region ?? ""} />
      <input name={fieldName(prefix, "country")} type="hidden" value={selected?.country ?? ""} />
    </>
  );
}

export function FormRow({
  children,
  compact = false,
  error,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  compact?: boolean;
  error?: string;
  htmlFor: string;
  label: string;
}) {
  return (
    <FormField className={compact ? COMPACT_FORM_FIELD_CLASS : undefined} error={error} id={htmlFor} label={label}>
      {children}
    </FormField>
  );
}
