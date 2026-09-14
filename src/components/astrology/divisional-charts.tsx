"use client";

import { useState } from "react";
import { PlanetPositionTable } from "@/components/astrology/planet-position-table";
import { VedicChart } from "@/components/astrology/vedic-chart";
import { AstrologyDataTable, type AstrologyTableColumn } from "@/components/astrology/data-table";
import { getSignName } from "@/lib/astrology/charts/signs";
import type { Shodashvarga, ShodashvargaRow } from "@/lib/astrology/charts/factory";
import type { VedicChartData } from "@/lib/astrology/charts/types";
import { cn } from "@/lib/utils";

/**
 * The sixteen divisional charts.
 *
 * One chart is drawn at a time rather than sixteen at once. All sixteen are
 * already calculated - they are a few numbers each - but rendering sixteen
 * SVGs and sixteen tables on load costs far more than it tells anyone, and a
 * chart is read one at a time regardless.
 *
 * The Shodashvarga table stays visible underneath, because reading one planet
 * across every division is the thing this view exists for, and that is lost if
 * it is hidden behind the chart being shown.
 */

export type DivisionalChartEntry = {
  division: number;
  name: string;
  significance: string;
  data: VedicChartData;
};

export function DivisionalCharts({
  charts,
  table,
}: {
  charts: readonly DivisionalChartEntry[];
  table: Shodashvarga;
}) {
  const [division, setDivision] = useState(charts[0]?.division ?? 1);
  const selected = charts.find((chart) => chart.division === division) ?? charts[0];

  if (!selected) return null;

  const columns: AstrologyTableColumn<ShodashvargaRow>[] = [
    {
      id: "planet",
      label: "Planet",
      rowHeader: true,
      cell: (row) => <span className="font-semibold text-foreground">{row.planet}</span>,
    },
    ...table.divisions.map((entry) => ({
      id: `d${entry.division}`,
      label: `D${entry.division}`,
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      cell: (row: ShodashvargaRow) => getSignName(row.signs[entry.division]),
    })),
  ];

  return (
    <div className="grid gap-6">
      <div>
        {/* A scrolling row of chips rather than a select: the divisions are a
            known, ordered set and an astrologer moves between neighbours. */}
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex w-max gap-2">
            {charts.map((chart) => {
              const active = chart.division === selected.division;
              return (
                <button
                  aria-pressed={active}
                  className={cn(
                    "min-h-9 shrink-0 rounded-md border px-3 py-2 text-xs font-semibold transition",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    active
                      ? "border-premium bg-premium/15 text-premium"
                      : "border-border bg-surface text-foreground-secondary hover:border-border-strong hover:bg-surface-hover hover:text-foreground",
                  )}
                  key={chart.division}
                  onClick={() => setDivision(chart.division)}
                  type="button"
                >
                  D{chart.division}
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-3 body-sm text-foreground-secondary">
          <span className="font-semibold text-foreground">
            D{selected.division} {selected.name}
          </span>{" "}
          · {selected.significance}
        </p>
      </div>

      <VedicChart
        data={selected.data}
        label={`D${selected.division} ${selected.name} chart`}
        showDegrees
      />

      <PlanetPositionTable
        caption={`Planetary positions in the ${selected.name} chart`}
        data={selected.data}
      />

      <div className="grid gap-2">
        <h3 className="heading-sm">Shodashvarga</h3>
        <p className="body-sm text-foreground-secondary">
          Each planet&apos;s sign in every division. Scroll sideways to read across.
        </p>
        {/* The table is wider than a phone and is allowed to scroll inside its
            own wrapper. The page itself never scrolls sideways. */}
        <AstrologyDataTable
          columns={columns}
          rowKey={(row) => row.planet}
          rows={table.rows}
        />
      </div>
    </div>
  );
}
