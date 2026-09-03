"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { calculatePanchangAction } from "@/app/calculators/actions";
import { INITIAL_PANCHANG_STATE, type PanchangState } from "@/lib/astrology/tool-action-state";
import type { LocationSuggestion } from "@/lib/kundli/types";
import type { PanchangResult } from "@/lib/astrology/tool-types";

/**
 * Panchang for a date and place.
 *
 * The place resolves through the same LocationProvider the birth tools use, so
 * the timezone applied is the location's own. The result therefore describes the
 * local calendar day at that place, not a UTC day.
 */
export function PanchangForm({ defaultDate }: { defaultDate: string }) {
  const [state, action] = useActionState<PanchangState, FormData>(calculatePanchangAction, INITIAL_PANCHANG_STATE);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [selected, setSelected] = useState<LocationSuggestion | null>(null);
  const listId = useId();
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

  return (
    <form action={action} className="grid gap-5" noValidate>
      {state.formErrors.length ? (
        <div className="rounded-md border border-danger/50 bg-background p-4 body-sm text-danger" role="alert">
          {state.formErrors.join(" ")}
        </div>
      ) : null}

      <label className="grid gap-2 caption text-foreground-secondary" htmlFor={`${uid}-date`}>
        Date
        <Input defaultValue={defaultDate} id={`${uid}-date`} name="date" required type="date" />
        {state.fieldErrors.date?.[0] ? (
          <span className="body-sm text-danger" role="alert">
            {state.fieldErrors.date[0]}
          </span>
        ) : null}
      </label>

      <div className="relative">
        <label className="grid gap-2 caption text-foreground-secondary" htmlFor={`${uid}-place`}>
          Place
          <Input
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={suggestions.length > 0}
            autoComplete="off"
            id={`${uid}-place`}
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
          {state.fieldErrors.placeId?.[0] ? (
            <span className="body-sm text-danger" role="alert">
              {state.fieldErrors.placeId[0]}
            </span>
          ) : null}
        </label>

        {suggestions.length ? (
          <div
            className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-[var(--shadow-lg)]"
            id={listId}
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

      <input name="placeId" type="hidden" value={selected?.placeId ?? ""} />

      <Submit />

      {state.result ? <PanchangReport result={state.result} /> : null}
    </form>
  );
}

function Submit() {
  const status = useFormStatus();
  return (
    <Button className="w-full" size="lg" type="submit" variant="premium">
      {status.pending ? "Calculating Panchang..." : "Show Panchang"}
    </Button>
  );
}

function PanchangReport({ result }: { result: PanchangResult }) {
  const rows: Array<{ label: string; value: string }> = [];

  if (result.vara) rows.push({ label: "Vara (weekday)", value: result.vara });
  if (result.tithi) {
    rows.push({
      label: "Tithi",
      value: `${result.tithi.name} · ${result.tithi.paksha} Paksha`,
    });
  }
  if (result.nakshatra) {
    rows.push({
      label: "Nakshatra",
      value: result.nakshatra.pada ? `${result.nakshatra.name} (Pada ${result.nakshatra.pada})` : result.nakshatra.name,
    });
  }
  if (result.yoga) rows.push({ label: "Yoga", value: result.yoga.description ? `${result.yoga.name} — ${result.yoga.description}` : result.yoga.name });
  if (result.karana) rows.push({ label: "Karana", value: result.karana });
  if (result.lunarMonth) rows.push({ label: "Lunar month", value: result.lunarMonth });
  if (result.sunrise) rows.push({ label: "Sunrise", value: result.sunrise });
  if (result.sunset) rows.push({ label: "Sunset", value: result.sunset });
  if (result.horaLord) rows.push({ label: "Hora lord", value: result.horaLord });
  if (result.dishaShool) rows.push({ label: "Disha Shool", value: result.dishaShool });
  if (result.ayanamsaValue) rows.push({ label: "Ayanamsa", value: result.ayanamsaValue });

  return (
    <div aria-live="polite" className="grid gap-4">
      <Card className="p-5" variant="astrology">
        <h2 className="heading-sm">
          {result.location.displayName} · {result.date}
        </h2>
        <p className="mt-1 caption text-foreground-muted">
          All times are local to {result.location.timezone}.
        </p>

        <dl className="mt-4 grid gap-2.5">
          {rows.map((row) => (
            <div className="flex flex-wrap justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0" key={row.label}>
              <dt className="body-sm text-foreground-muted">{row.label}</dt>
              <dd className="body-sm font-semibold text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {result.unavailableFields.length > 0 ? (
        <Card className="p-5">
          <h3 className="heading-sm">Not included</h3>
          <p className="mt-2 body-sm text-foreground-secondary">
            Our calculation engine does not compute the following, so they are not shown rather than estimated:
          </p>
          <ul className="mt-2 grid gap-1">
            {result.unavailableFields.map((field) => (
              <li className="caption text-foreground-muted" key={field}>
                · {field}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
