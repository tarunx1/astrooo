"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { BirthDetailsFields } from "@/components/kundli/birth-details-fields";
import { calculateBirthToolAction, calculateSadeSatiAction } from "@/app/calculators/actions";
import {
  INITIAL_BIRTH_TOOL_STATE,
  INITIAL_SADE_SATI_STATE,
  type BirthToolState,
  type SadeSatiState,
} from "@/lib/astrology/tool-action-state";

/**
 * Birth-details tool form.
 *
 * Renders the canonical `BirthDetailsFields`, so the fields, validation contract
 * and place resolution are identical to the Kundli form. The result is returned
 * in action state and rendered beside the form: no birth detail is ever placed
 * in a URL.
 */
type Slice = "moonSign" | "nakshatra" | "lagna";

export function BirthToolForm({
  slice,
  submitLabel,
}: {
  slice: Slice;
  submitLabel: string;
}) {
  const [state, action] = useActionState<BirthToolState, FormData>(calculateBirthToolAction, INITIAL_BIRTH_TOOL_STATE);

  return (
    <form action={action} className="grid gap-5" noValidate>
      {state.formErrors.length ? (
        <div className="rounded-md border border-danger/50 bg-background p-4 body-sm text-danger" role="alert">
          {state.formErrors.join(" ")}
        </div>
      ) : null}

      <BirthDetailsFields fieldError={(field) => state.fieldErrors[field]?.[0]} />
      <Submit label={submitLabel} />

      {state.result ? <BirthToolResult result={state.result} slice={slice} /> : null}
    </form>
  );
}


/**
 * Fixture disclosure.
 *
 * A development-fixture result must never look like a real calculation. This is
 * rendered above any result whose metadata says it came from the fixture
 * provider, matching the notice the Kundli result page already shows.
 */
function FixtureNotice({ isFixture }: { isFixture: boolean }) {
  if (!isFixture) return null;

  return (
    <div className="flex gap-3 rounded-lg border border-warning/60 bg-surface p-4 text-warning" role="status">
      <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
      <p className="body-sm text-foreground-secondary">
        <strong className="text-warning">Development fixture.</strong> This environment is not configured with a real
        astrology engine, so this value is placeholder data and not a genuine astronomical calculation.
      </p>
    </div>
  );
}

function BirthToolResult({ result, slice }: { result: NonNullable<BirthToolState["result"]>; slice: Slice }) {
  const rows =
    slice === "moonSign"
      ? [
          { label: "Moon Sign (Rashi)", value: result.moonSign },
          { label: "Nakshatra", value: `${result.nakshatra.name} (Pada ${result.nakshatra.pada})` },
          ...(result.moonPosition
            ? [{ label: "Moon degree", value: `${result.moonPosition.degreeInSign}° in ${result.moonPosition.sign}` }]
            : []),
        ]
      : slice === "nakshatra"
        ? [
            { label: "Nakshatra", value: result.nakshatra.name },
            { label: "Pada", value: String(result.nakshatra.pada) },
            { label: "Moon Sign", value: result.moonSign },
            ...(result.moonPosition
              ? [{ label: "Moon longitude", value: `${result.moonPosition.longitude}°` }]
              : []),
          ]
        : [
            { label: "Ascendant (Lagna)", value: result.ascendant.sign },
            { label: "Degree in sign", value: `${result.ascendant.degree}°` },
            { label: "Moon Sign", value: result.moonSign },
            { label: "Sun Sign", value: result.sunSign },
          ];

  return (
    <Card aria-live="polite" className="p-5" variant="astrology">
      <FixtureNotice isFixture={result.calculationMetadata.isDevelopmentFixture} />
      <h2 className="heading-sm mt-3 first:mt-0">Your result</h2>
      <dl className="mt-3 grid gap-2.5">
        {rows.map((row) => (
          <div className="flex flex-wrap justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0" key={row.label}>
            <dt className="body-sm text-foreground-muted">{row.label}</dt>
            <dd className="body-sm font-semibold text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 caption text-foreground-muted">
        Calculated with {result.calculationMetadata.ayanamsa} ayanamsa
        {result.fromCache ? " · served from a cached calculation" : ""}.
      </p>
    </Card>
  );
}

export function SadeSatiForm() {
  const [state, action] = useActionState<SadeSatiState, FormData>(calculateSadeSatiAction, INITIAL_SADE_SATI_STATE);

  return (
    <form action={action} className="grid gap-5" noValidate>
      {state.formErrors.length ? (
        <div className="rounded-md border border-danger/50 bg-background p-4 body-sm text-danger" role="alert">
          {state.formErrors.join(" ")}
        </div>
      ) : null}

      <BirthDetailsFields fieldError={(field) => state.fieldErrors[field]?.[0]} />
      <Submit label="Check Sade Sati" />

      {state.result ? (
        <Card aria-live="polite" className="p-5" variant={state.result.isSadeSati ? "premium" : "astrology"}>
          <FixtureNotice isFixture={state.result.calculationMetadata.isDevelopmentFixture} />
          <h2 className="heading-sm mt-3 first:mt-0">{state.result.title}</h2>
          <p className="mt-2 body-sm text-foreground-secondary">{state.result.summary}</p>

          <dl className="mt-4 grid gap-2.5">
            <Row label="Your Moon sign" value={state.result.moonSign} />
            <Row label="Saturn is now in" value={state.result.saturnSign} />
            <Row label="Counted from the Moon" value={`${state.result.housesFromMoon} of 12`} />
          </dl>

          <p className="mt-4 caption text-foreground-muted">Rule applied: {state.result.ruleApplied}</p>
        </Card>
      ) : null}
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <dt className="body-sm text-foreground-muted">{label}</dt>
      <dd className="body-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function Submit({ label }: { label: string }) {
  const status = useFormStatus();
  return (
    <Button className="mt-1 w-full" size="lg" type="submit" variant="premium">
      {status.pending ? "Calculating..." : label}
    </Button>
  );
}
