"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { calculatePanchangAction } from "@/app/calculators/actions";
import { INITIAL_PANCHANG_STATE, type PanchangState } from "@/lib/astrology/tool-action-state";
import type { LocationSuggestion } from "@/lib/kundli/types";
import type { PanchangResult } from "@/lib/astrology/tool-types";
import { cn } from "@/lib/utils";

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

  const inputClassName =
    "min-h-[52px] rounded-[12px] border-border/70 bg-background/50 py-2.5 text-sm placeholder:text-foreground-muted/85 hover:border-premium/45 focus:border-premium focus:outline-premium/35 focus-visible:border-premium focus-visible:outline-premium/35";
  const fieldClassName = "gap-1.5";
  const iconClassName = "pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-premium/80";

  return (
    <form
      action={action}
      className="grid max-w-[960px] gap-3 rounded-xl border border-border/65 bg-surface/72 p-4 shadow-[var(--shadow-sm)] backdrop-blur-xl md:grid-cols-[minmax(180px,0.8fr)_minmax(280px,1.35fr)_240px] md:items-end"
      noValidate
    >
      {state.formErrors.length ? (
        <div className="rounded-md border border-danger/50 bg-background p-4 body-sm text-danger md:col-span-3" role="alert">
          {state.formErrors.join(" ")}
        </div>
      ) : null}

      <FormField className={fieldClassName} error={state.fieldErrors.date?.[0]} id={`${uid}-date`} label="Date">
        <div className="relative">
          <CalendarDays aria-hidden="true" className={iconClassName} size={17} strokeWidth={1.8} />
          <Input className={cn(inputClassName, "pl-10")} defaultValue={defaultDate} id={`${uid}-date`} name="date" required type="date" />
        </div>
      </FormField>

      <div className="relative">
        <FormField className={fieldClassName} error={state.fieldErrors.placeId?.[0]} id={`${uid}-place`} label="Place">
          <div className="relative">
            <MapPin aria-hidden="true" className={iconClassName} size={17} strokeWidth={1.8} />
            <Input
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded={suggestions.length > 0}
              autoComplete="off"
              className={cn(inputClassName, "pl-10")}
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
          </div>
        </FormField>

        {suggestions.length ? (
          <div
            className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-[12px] border border-border/80 bg-surface shadow-[var(--shadow-lg)]"
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

      {state.result ? (
        <div className="md:col-span-3">
          <PanchangReport result={state.result} />
        </div>
      ) : null}
    </form>
  );
}

function Submit() {
  const status = useFormStatus();
  return (
    <Button
      className="mt-1 min-h-[46px] w-full rounded-[12px] px-7 py-2.5 text-sm shadow-[0_10px_28px_rgb(214_181_109/0.18)] hover:-translate-y-0.5 hover:opacity-100 active:translate-y-0 active:scale-[0.99] md:w-[240px]"
      size="md"
      type="submit"
      variant="premium"
    >
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
