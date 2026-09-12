"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Loader2, RotateCcw } from "lucide-react";
import { VedicChart } from "@/components/astrology/vedic-chart";
import { getSignName } from "@/lib/astrology/charts/signs";
import { cn } from "@/lib/utils";
import { loadGocharChartAction } from "@/app/kundli/result/[id]/actions";
import type { VedicChartData } from "@/lib/astrology/charts/types";

/**
 * The natal chart and the transits, in one frame.
 *
 * KP judges a matter by the cusp, and a reader working a question wants to see
 * where the planets are *now* against where they were at birth. Putting both
 * behind one toggle keeps that comparison in a single place rather than making
 * someone hold one chart in their head while they scroll to the other.
 *
 * Only the Gochar side is interactive, and only it calls the server. The natal
 * chart is passed in already computed from the stored calculation - asking for
 * a different transit date must never re-derive or overwrite the birth chart,
 * which is immutable by design.
 */
type Mode = "lagna" | "gochar";
type Reference = "lagna" | "moon";

/** Bounds mirrored from the action, which enforces them regardless. */
const MIN_DATE = "1900-01-01";
const MAX_DATE = "2100-12-31";

function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function TransitChartSwitcher({
  natal,
  natalLagnaSign,
  natalMoonSign,
}: {
  natal: VedicChartData;
  natalLagnaSign: number;
  natalMoonSign: number;
}) {
  const [mode, setMode] = useState<Mode>("lagna");
  const [reference, setReference] = useState<Reference>("lagna");
  const [date, setDate] = useState<string>(today());

  const [chart, setChart] = useState<VedicChartData | null>(null);
  const [atISO, setAtISO] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const referenceSign = reference === "lagna" ? natalLagnaSign : natalMoonSign;

  /**
   * Identifies the transit currently being asked for.
   *
   * Loading is derived by comparing this with the request the held result came
   * from, rather than set at the top of the effect - a synchronous setState in
   * an effect body costs a render pass before the work has even begun.
   */
  const requestKey = mode === "gochar" ? `${date}|${referenceSign}` : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = requestKey !== null && loadedKey !== requestKey;

  useEffect(() => {
    if (requestKey === null) return;

    let cancelled = false;

    async function run() {
      const result = await loadGocharChartAction({ date, reference, referenceSign });

      // A slower earlier request must not overwrite a newer one's answer.
      if (cancelled) return;

      if (!result.ok) {
        setChart(null);
        setAtISO(null);
        setError(result.message);
      } else {
        setChart(result.chart);
        setAtISO(result.atISO);
        setError(null);
      }

      setLoadedKey(requestKey);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [requestKey, date, reference, referenceSign]);

  const tab = (value: Mode, label: string, hint: string) => (
    <button
      aria-pressed={mode === value}
      className={cn(
        "min-h-10 rounded-md border px-4 body-sm font-medium transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
        mode === value
          ? "border-premium/60 bg-premium/10 text-foreground"
          : "border-border text-foreground-secondary hover:border-border-strong hover:text-foreground",
      )}
      key={value}
      onClick={() => setMode(value)}
      title={hint}
      type="button"
    >
      {label}
    </button>
  );

  return (
    <section aria-labelledby="transit-switcher-heading" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="heading-sm" id="transit-switcher-heading">
          Chart
        </h3>
        <div className="flex flex-wrap gap-2">
          {tab("lagna", "Lagna", "The birth chart, from the stored calculation")}
          {tab("gochar", "Gochar", "Where the planets are on a date you choose")}
        </div>
      </div>

      {mode === "gochar" ? (
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface-raised p-3">
          <div className="min-w-[10rem] flex-1">
            <label className="mb-1.5 block caption text-foreground-muted" htmlFor="gochar-date">
              Date
            </label>
            <div className="relative">
              <CalendarDays
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                size={15}
              />
              <input
                className="form-control min-h-10 w-full pl-9"
                id="gochar-date"
                max={MAX_DATE}
                min={MIN_DATE}
                onChange={(event) => setDate(event.target.value)}
                type="date"
                value={date}
              />
            </div>
          </div>

          <div className="min-w-[10rem] flex-1">
            <label className="mb-1.5 block caption text-foreground-muted" htmlFor="gochar-reference">
              Count houses from
            </label>
            <select
              className="form-control min-h-10 w-full"
              id="gochar-reference"
              onChange={(event) => setReference(event.target.value as Reference)}
              value={reference}
            >
              <option value="lagna">Lagna — {getSignName(natalLagnaSign)}</option>
              <option value="moon">Moon — {getSignName(natalMoonSign)}</option>
            </select>
          </div>

          {date !== today() ? (
            <button
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3 caption font-semibold text-foreground-secondary transition hover:border-border-strong hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
              onClick={() => setDate(today())}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={13} />
              Today
            </button>
          ) : null}
        </div>
      ) : null}

      <div aria-busy={loading} aria-live="polite">
        {mode === "lagna" ? (
          <div className="grid gap-3">
            <VedicChart data={natal} label="Lagna: the birth chart" />
            <p className="caption text-foreground-muted">
              The birth chart, counted from the Lagna in {getSignName(natalLagnaSign)}. Calculated once and
              stored, so it never changes.
            </p>
          </div>
        ) : error ? (
          <p className="rounded-md border border-warning/40 p-3 body-sm text-foreground-secondary" role="alert">
            {error}
          </p>
        ) : chart === null ? (
          <p className="flex items-center gap-2 py-8 body-sm text-foreground-muted">
            <Loader2 aria-hidden="true" className="animate-spin" size={15} />
            Calculating transits
          </p>
        ) : (
          <div className={cn("grid gap-3 transition-opacity", loading && "opacity-60")}>
            <VedicChart data={chart} label="Gochar: transiting planets" />
            <p className="caption text-foreground-muted">
              {atISO ? (
                <>
                  Positions for{" "}
                  <time dateTime={atISO}>
                    {new Date(atISO).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                  .{" "}
                </>
              ) : null}
              Houses counted from the natal{" "}
              {reference === "lagna"
                ? `Lagna in ${getSignName(natalLagnaSign)}`
                : `Moon in ${getSignName(natalMoonSign)}`}
              . The birth chart is unchanged by this.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
