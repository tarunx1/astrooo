"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { calculateNumerologyAction } from "@/app/calculators/actions";
import { INITIAL_NUMEROLOGY_STATE, type NumerologyState } from "@/lib/astrology/tool-action-state";
import type { NumerologyResult } from "@/lib/numerology/types";

/**
 * Numerology.
 *
 * Every number here is produced by deterministic TypeScript arithmetic, and the
 * derivation is shown alongside each result so a reader can check it by hand.
 */
export function NumerologyForm() {
  const [state, action] = useActionState<NumerologyState, FormData>(
    calculateNumerologyAction,
    INITIAL_NUMEROLOGY_STATE,
  );
  const uid = useId();
  const inputClassName =
    "min-h-[52px] rounded-[12px] border-border/70 bg-background/50 px-3.5 py-2.5 text-sm placeholder:text-foreground-muted/85 hover:border-premium/45 focus:border-premium focus:outline-premium/35 focus-visible:border-premium focus-visible:outline-premium/35";

  return (
    <form action={action} className="grid max-w-[520px] gap-4 rounded-xl border border-border/65 bg-surface/72 p-4 shadow-[var(--shadow-sm)] backdrop-blur-xl sm:p-5" noValidate>
      {state.formErrors.length ? (
        <div className="rounded-md border border-danger/50 bg-background p-4 body-sm text-danger" role="alert">
          {state.formErrors.join(" ")}
        </div>
      ) : null}

      <FormField className="gap-1.5" error={state.fieldErrors.dateOfBirth?.[0]} id={`${uid}-dob`} label="Date of Birth">
        <Input className={inputClassName} id={`${uid}-dob`} name="dateOfBirth" required type="date" />
      </FormField>

      <FormField className="gap-1.5 [&_label]:text-foreground-muted" error={state.fieldErrors.name?.[0]} id={`${uid}-name`} label="Full name (optional)">
        <Input autoComplete="name" className={inputClassName} id={`${uid}-name`} name="name" placeholder="For name-based numbers" />
      </FormField>

      <Submit />

      {state.result ? <NumerologyReport result={state.result} /> : null}
    </form>
  );
}

function Submit() {
  const status = useFormStatus();
  return (
    <Button className="min-h-[46px] w-full rounded-[12px] px-7 py-2.5 text-sm shadow-[0_10px_28px_rgb(214_181_109/0.18)] hover:-translate-y-0.5 hover:opacity-100 active:translate-y-0 active:scale-[0.99] sm:w-fit" size="md" type="submit" variant="premium">
      {status.pending ? "Calculating..." : "Calculate Numbers"}
    </Button>
  );
}

function NumerologyReport({ result }: { result: NumerologyResult }) {
  return (
    <div aria-live="polite" className="grid gap-4">
      <ul className="grid gap-3">
        {result.numbers.map((number) => (
          <li key={number.key}>
            <Card className="p-5" variant="astrology">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="heading-sm">{number.label}</h3>
                <p className="flex items-baseline gap-2">
                  <span className="font-display text-3xl leading-none text-premium">{number.value}</span>
                  {number.isMasterNumber ? (
                    <span className="rounded-full border border-premium/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-premium">
                      Master
                    </span>
                  ) : null}
                </p>
              </div>
              <p className="mt-2 body-sm text-foreground-secondary">Ruling planet: {number.ruler}</p>
              <p className="mt-1 caption text-foreground-muted">Working: {number.workings}</p>
            </Card>
          </li>
        ))}
      </ul>

      {result.unavailable.length > 0 ? (
        <Card className="p-5">
          <h3 className="heading-sm">Not calculated</h3>
          <ul className="mt-2 grid gap-1">
            {result.unavailable.map((entry) => (
              <li className="caption text-foreground-muted" key={entry.label}>
                · {entry.label} — {entry.reason}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="caption text-foreground-muted">
        Calculated with the Chaldean system. Master numbers 11, 22 and 33 are preserved in the Life Path and
        name-based numbers, and reduced in the Birth Number by tradition.
      </p>
    </div>
  );
}
