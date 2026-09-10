"use client";

import { useMemo, useState } from "react";
import type { PlanetName } from "@/config/astrology";
import {
  DASHA_LEVELS,
  buildDashaTimeline,
  subdivideDasha,
  type DashaPeriod,
} from "@/lib/astrology/engine/dasha";
import { cn } from "@/lib/utils";

/**
 * The Vimshottari dasha as an openable tree.
 *
 * Only the mahadashas are built up front. A period is subdivided when it is
 * opened, because four levels deep is over seven thousand periods and a reader
 * opens perhaps a dozen - building them all, let alone sending them to the
 * browser, would be work done for nothing.
 *
 * The chain running today is open when the page arrives, all the way down to
 * Sookshma. That is the part anyone came to read; everything else is one click
 * away and closed.
 */
const SHORT: Record<string, string> = {
  Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me",
  Jupiter: "Ju", Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke",
};

type Props = {
  /** Birth instant, ISO. The timeline is shown from here, never before it. */
  birthISO: string;
  moonLongitude: number;
  /** Houses each planet signifies, so a lord can be read with its numbers. */
  houses: Record<string, number[]>;
};

const monthYear = (date: Date) =>
  date.toLocaleDateString("en-GB", { year: "numeric", month: "short", timeZone: "UTC" });

/** A period's identity in the tree, e.g. "Venus/Sun/Moon". */
const pathOf = (ancestors: DashaPeriod[], period: DashaPeriod) =>
  [...ancestors, period].map((entry) => entry.lord).join("/");

export function DashaTree({ birthISO, moonLongitude, houses }: Props) {
  const birth = useMemo(() => new Date(birthISO), [birthISO]);
  const now = useMemo(() => new Date(), []);

  const timeline = useMemo(
    // One level: the rest is built as it is opened.
    () => buildDashaTimeline(birth, moonLongitude, 1),
    [birth, moonLongitude],
  );

  /**
   * The chain running today, opened by default.
   *
   * Walked here rather than taken from the timeline, because the timeline only
   * holds mahadashas until something is opened.
   */
  const openByDefault = useMemo(() => {
    const open = new Set<string>();
    let level = timeline.periods;
    const ancestors: DashaPeriod[] = [];

    for (let depth = 0; depth < DASHA_LEVELS.length - 1; depth += 1) {
      const running = level.find((period) => now >= period.start && now < period.end);
      if (!running) break;
      open.add(pathOf(ancestors, running));
      ancestors.push(running);
      level = subdivideDasha(running);
    }
    return open;
  }, [timeline, now]);

  const [opened, setOpened] = useState<Set<string>>(openByDefault);

  const toggle = (path: string) =>
    setOpened((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const label = (lord: PlanetName) => {
    const signifies = houses[lord];
    return `${lord.toUpperCase()}-${signifies?.length ? signifies.join(",") : "—"}`;
  };

  // Nothing that finished before the birth is shown, and the period the birth
  // falls inside starts at the birth rather than where it truly began.
  const fromBirth = timeline.periods.filter((period) => period.end > birth);

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[22rem] border-collapse text-left">
        <caption className="sr-only">
          Vimshottari periods from birth, openable to Sookshma, with the houses each lord signifies
        </caption>
        <thead className="bg-premium text-background">
          <tr>
            {["Period", "From", "To"].map((heading) => (
              <th className="border-r border-background/25 px-3 py-2 text-sm font-semibold last:border-r-0" key={heading} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fromBirth.map((period) => (
            <Rows
              ancestors={[]}
              birth={birth}
              key={period.lord}
              label={label}
              now={now}
              onToggle={toggle}
              opened={opened}
              period={period}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Rows({
  period,
  ancestors,
  birth,
  now,
  opened,
  onToggle,
  label,
}: {
  period: DashaPeriod;
  ancestors: DashaPeriod[];
  birth: Date;
  now: Date;
  opened: Set<string>;
  onToggle: (path: string) => void;
  label: (lord: PlanetName) => string;
}) {
  const depth = ancestors.length;
  const path = pathOf(ancestors, period);
  const isOpen = opened.has(path);
  const canOpen = depth < DASHA_LEVELS.length - 1;
  const running = now >= period.start && now < period.end;

  // The period the birth falls inside is shown from the birth onward: the part
  // before it belongs to a life that had not started.
  const start = period.start < birth ? birth : period.start;

  const children = isOpen && canOpen ? subdivideDasha(period).filter((child) => child.end > birth) : [];

  return (
    <>
      <tr
        className={cn(
          "border-t border-border",
          running && "bg-surface-raised",
          depth > 0 && "border-border/60",
        )}
      >
        <th className="border-r border-border px-3 py-2 text-left font-normal" scope="row">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 14}px` }}>
            {canOpen ? (
              <button
                aria-expanded={isOpen}
                aria-label={`${isOpen ? "Collapse" : "Expand"} ${period.lord} ${DASHA_LEVELS[depth]}`}
                className="grid size-5 shrink-0 place-items-center rounded border border-border text-foreground-muted transition hover:border-premium hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                onClick={() => onToggle(path)}
                type="button"
              >
                <span aria-hidden="true" className="text-xs leading-none">{isOpen ? "−" : "+"}</span>
              </button>
            ) : (
              <span aria-hidden="true" className="size-5 shrink-0" />
            )}

            {ancestors.length > 0 ? (
              <span className="caption text-foreground-muted">
                {ancestors.map((entry) => SHORT[entry.lord]).join("/")} /
              </span>
            ) : null}

            <span className={cn(depth === 0 ? "font-medium text-foreground" : "body-sm text-foreground-secondary")}>
              {label(period.lord)}
            </span>

            {running ? (
              <span className="rounded-full border border-premium/60 px-1.5 caption text-premium">now</span>
            ) : null}
          </div>
        </th>
        <td className="border-r border-border px-3 py-2 tabular-nums text-foreground-secondary">
          {monthYear(start)}
        </td>
        <td className="px-3 py-2 tabular-nums text-foreground-secondary">{monthYear(period.end)}</td>
      </tr>

      {children.map((child) => (
        <Rows
          ancestors={[...ancestors, period]}
          birth={birth}
          key={`${path}/${child.lord}`}
          label={label}
          now={now}
          onToggle={onToggle}
          opened={opened}
          period={child}
        />
      ))}
    </>
  );
}
