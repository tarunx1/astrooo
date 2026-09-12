"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BirthDetailsFields } from "@/components/kundli/birth-details-fields";
import { calculateCompatibilityAction } from "@/app/calculators/actions";
import { INITIAL_COMPATIBILITY_STATE, type CompatibilityState } from "@/lib/astrology/tool-action-state";
import type { CompatibilityResult, KootaStatus } from "@/lib/astrology/tool-types";
import { cn } from "@/lib/utils";

/**
 * Kundli matching.
 *
 * Two people, one submission, using the same canonical birth fields as every
 * other birth tool. The two field sets stack vertically on small screens and sit
 * side by side only from `lg`, so a phone never has to render two full forms
 * across a row.
 */
export function MatchingForm() {
  const [state, action] = useActionState<CompatibilityState, FormData>(
    calculateCompatibilityAction,
    INITIAL_COMPATIBILITY_STATE,
  );

  const fieldError = (field: string) => state.fieldErrors[field]?.[0];

  return (
    <form action={action} className="grid max-w-[900px] gap-4" noValidate>
      {state.formErrors.length ? (
        <div className="rounded-md border border-danger/50 bg-background p-4 body-sm text-danger" role="alert">
          {state.formErrors.join(" ")}
        </div>
      ) : null}

      <div className="relative grid gap-4 rounded-xl border border-border/55 bg-surface/62 p-3 backdrop-blur-xl lg:grid-cols-[1fr_56px_1fr] lg:items-stretch">
        <Card className="h-full border-border/55 bg-background/32 p-3.5 shadow-none ring-1 ring-premium/5">
          <fieldset className="grid h-full gap-3.5">
            <legend className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="grid size-7 place-items-center rounded-full border border-premium/30 bg-premium/10 text-xs text-premium">A</span>
              Birth profile
            </legend>
            <BirthDetailsFields compact fieldError={fieldError} nameLabel="Full name" prefix="a" />
          </fieldset>
        </Card>

        <div className="grid place-items-center self-center text-premium">
          <span className="grid size-12 place-items-center rounded-full border border-premium/35 bg-premium/12 font-display text-2xl shadow-[0_0_24px_rgb(214_181_109/0.14)]" aria-hidden="true">
            ♡
          </span>
          <span className="sr-only">matched with</span>
        </div>

        <Card className="h-full border-border/55 bg-background/32 p-3.5 shadow-none ring-1 ring-accent-cyan/5">
          <fieldset className="grid h-full gap-3.5">
            <legend className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="grid size-7 place-items-center rounded-full border border-accent-cyan/30 bg-accent-cyan/10 text-xs text-accent-cyan">B</span>
              Birth profile
            </legend>
            <BirthDetailsFields compact fieldError={fieldError} nameLabel="Full name" prefix="b" />
          </fieldset>
        </Card>
      </div>

      <Submit />

      {state.result ? <CompatibilityReport result={state.result} /> : null}
    </form>
  );
}

function Submit() {
  const status = useFormStatus();
  return (
    <Button className="min-h-[46px] w-full rounded-[12px] px-7 py-2.5 text-sm shadow-[0_10px_28px_rgb(214_181_109/0.18)] hover:-translate-y-0.5 hover:opacity-100 active:translate-y-0 active:scale-[0.99] sm:w-[280px]" size="md" type="submit" variant="premium">
      {status.pending ? "Calculating compatibility..." : "Check Compatibility"}
    </Button>
  );
}

const STATUS_LABEL: Record<KootaStatus, string> = {
  favourable: "Favourable",
  unfavourable: "Unfavourable",
  neutral: "Neutral",
  unknown: "Not reported",
};

const STATUS_CLASS: Record<KootaStatus, string> = {
  favourable: "border-success/50 text-success",
  unfavourable: "border-danger/50 text-danger",
  neutral: "border-border-strong text-foreground-secondary",
  unknown: "border-border text-foreground-muted",
};

/** Score bands, phrased as traditional assessment rather than a prediction. */
function interpretation(score: number, max: number): string {
  const ratio = score / max;
  if (ratio >= 0.75) return "In traditional Ashtakoota terms this is a strong match.";
  if (ratio >= 0.5) return "In traditional Ashtakoota terms this is considered an acceptable match.";
  if (ratio >= 0.5 - 0.005) return "This sits on the traditional threshold and is usually reviewed in detail.";
  return "This falls below the traditional threshold, which is where an astrologer would normally look at the charts in detail rather than at the score alone.";
}

function CompatibilityReport({ result }: { result: CompatibilityResult }) {
  return (
    <div aria-live="polite" className="grid gap-5">
      <Card className="p-6" variant="premium">
        <h2 className="heading-md">Traditional Vedic compatibility assessment</h2>

        {result.score === null ? (
          <p className="mt-3 body-sm text-foreground-secondary">
            The calculation engine did not return an overall score for these details.
          </p>
        ) : (
          <>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-5xl leading-none text-premium">{result.score}</span>
              <span className="heading-sm text-foreground-muted">/ {result.maxScore} Gunas</span>
            </p>
            {/* Textual equivalent for the meter below. */}
            <p className="sr-only">
              Score {result.score} out of {result.maxScore}, which is {result.percentage} percent.
            </p>
            <div
              aria-hidden="true"
              className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-raised"
            >
              <div className="h-full rounded-full bg-premium" style={{ width: `${result.percentage ?? 0}%` }} />
            </div>
            <p className="mt-4 body-sm text-foreground-secondary">
              {interpretation(result.score, result.maxScore)}
            </p>
          </>
        )}

        <p className="mt-4 caption text-foreground-muted">
          This is a traditional compatibility assessment, not a prediction about whether a relationship will succeed.
        </p>
      </Card>

      <section aria-labelledby="koota-heading">
        <h3 className="heading-sm" id="koota-heading">
          Ashtakoota breakdown
        </h3>

        {!result.summaryMetadata.allKootaScoresProvided ? (
          <p className="mt-2 body-sm text-foreground-secondary">
            The calculation engine reported a numeric score for {result.summaryMetadata.kootasWithScores} of the{" "}
            {result.summaryMetadata.kootaCount} kootas. The others are shown with their favourable or unfavourable
            classification only — we do not estimate a score the engine did not calculate.
          </p>
        ) : null}

        <ul className="mt-4 grid gap-2">
          {result.kootas.map((koota) => (
            <li key={koota.key}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="body-sm font-semibold text-foreground">{koota.name}</p>
                  {koota.details ? (
                    <p className="mt-0.5 caption text-foreground-muted">{koota.details}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", STATUS_CLASS[koota.status])}>
                    {STATUS_LABEL[koota.status]}
                  </span>
                  <span className="body-sm text-foreground">
                    {koota.score === null ? (
                      <span className="text-foreground-muted">score not provided</span>
                    ) : (
                      `${koota.score} / ${koota.traditionalMaxScore}`
                    )}
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {result.manglikComparison ? (
        <Card className="p-5">
          <h3 className="heading-sm">Manglik (Kuja Dosha) comparison</h3>
          <p className="mt-2 body-sm text-foreground-secondary">{result.manglikComparison.summary}</p>
        </Card>
      ) : null}

      {result.additionalFindings.length > 0 ? (
        <section aria-labelledby="findings-heading">
          <h3 className="heading-sm" id="findings-heading">
            Other traditional checks
          </h3>
          <ul className="mt-3 grid gap-2">
            {result.additionalFindings.map((finding) => (
              <li key={finding.name}>
                <Card className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="body-sm font-semibold text-foreground">{finding.name}</p>
                    {finding.summary ? (
                      <p className="mt-0.5 caption text-foreground-muted">{finding.summary}</p>
                    ) : null}
                  </div>
                  <span className={cn("shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", STATUS_CLASS[finding.status])}>
                    {STATUS_LABEL[finding.status]}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
