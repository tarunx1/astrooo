import { AstrologyDataTable, type AstrologyTableColumn } from "@/components/astrology/data-table";
import {
  ASHTAKAVARGA_PLANETS,
  CLASSICAL_SARVA_TOTAL,
  calculateAshtakavarga,
  calculatePrasthara,
  type Bhinnashtakavarga,
} from "@/lib/astrology/charts/ashtakavarga";
import { getSignName } from "@/lib/astrology/charts/signs";
import type { VedicChartData } from "@/lib/astrology/charts/types";

/**
 * Ashtakavarga, as counts rather than verdicts.
 *
 * The bar behind each Sarvashtakavarga row is scaled against the strongest sign
 * in this chart, so it shows relief across the twelve at a glance. The number
 * stays on every row: the bar is an aid to reading the table, never a
 * replacement for it, and a sign with 28 bindus is not "good" or "bad" - it is
 * 28, and what that means belongs to interpretation, not to this table.
 */

/** Bindus in a sign, counted from the ascendant, as a house number. */
function houseOf(sign: number, ascendantSign: number): number {
  return ((sign - ascendantSign + 12) % 12) + 1;
}

export function AshtakavargaPanel({ chart }: { chart: VedicChartData }) {
  const { bhinna, sarva, sarvaTotal } = calculateAshtakavarga(chart);
  const strongest = Math.max(...Object.values(sarva));

  const sarvaRows = Array.from({ length: 12 }, (_, index) => {
    const sign = index + 1;
    return {
      sign,
      house: houseOf(sign, chart.ascendantSign),
      bindus: sarva[sign],
    };
  }).sort((a, b) => a.house - b.house);

  const sarvaColumns: AstrologyTableColumn<(typeof sarvaRows)[number]>[] = [
    { id: "house", label: "House", rowHeader: true, cell: (row) => row.house },
    { id: "sign", label: "Sign", cell: (row) => getSignName(row.sign) },
    {
      id: "bindus",
      label: "Bindus",
      cell: (row) => (
        <span className="flex items-center gap-2">
          <span className="font-semibold text-foreground tabular-nums">{row.bindus}</span>
          <span aria-hidden="true" className="h-1.5 w-full max-w-24 overflow-hidden rounded-full bg-surface-muted">
            <span
              className="block h-full rounded-full bg-premium/70"
              style={{ width: `${strongest > 0 ? (row.bindus / strongest) * 100 : 0}%` }}
            />
          </span>
        </span>
      ),
    },
  ];

  const bhinnaColumns: AstrologyTableColumn<Bhinnashtakavarga>[] = [
    {
      id: "planet",
      label: "Planet",
      rowHeader: true,
      cell: (row) => <span className="font-semibold text-foreground">{row.planet}</span>,
    },
    ...Array.from({ length: 12 }, (_, index) => ({
      id: `sign-${index + 1}`,
      label: getSignName(index + 1).slice(0, 3),
      headerClassName: "whitespace-nowrap",
      cellClassName: "tabular-nums",
      cell: (row: Bhinnashtakavarga) => row.bindus[index + 1],
    })),
    {
      id: "total",
      label: "Total",
      cellClassName: "font-semibold tabular-nums",
      cell: (row) => row.total,
    },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h3 className="heading-sm">Sarvashtakavarga</h3>
        <p className="body-sm text-foreground-secondary">
          The seven sheets added together, by house from the ascendant. Total {sarvaTotal} across the
          twelve signs.
        </p>
        <AstrologyDataTable columns={sarvaColumns} rowKey={(row) => String(row.sign)} rows={sarvaRows} />
      </div>

      <div className="grid gap-2">
        <h3 className="heading-sm">Bhinnashtakavarga</h3>
        <p className="body-sm text-foreground-secondary">
          Each planet&apos;s own sheet, sign by sign. Rahu and Ketu hold no Ashtakavarga in the classical
          system and are not counted. Scroll sideways to read across.
        </p>
        <AstrologyDataTable columns={bhinnaColumns} rowKey={(row) => row.planet} rows={bhinna} />
        <p className="caption text-foreground-muted">
          Each planet&apos;s total is fixed by the system rather than by this chart, and the twelve signs
          always sum to {CLASSICAL_SARVA_TOTAL}. Sheets are held for{" "}
          {ASHTAKAVARGA_PLANETS.length} planets.
        </p>
      </div>

      <div className="grid gap-2">
        <h3 className="heading-sm">Prasthara</h3>
        <p className="body-sm text-foreground-secondary">
          The same sheets with their working shown: which of the eight contributors gave each bindu. Open a
          planet to see its grid.
        </p>
        {/* One grid per planet, closed by default. Seven 8x12 tables at once
            would bury the sheets above, and a reader opens one at a time. */}
        {ASHTAKAVARGA_PLANETS.map((planet) => {
          const grid = calculatePrasthara(chart, planet);
          return (
            <details className="rounded-lg border border-border bg-surface-muted" key={planet}>
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">
                {planet} <span className="font-normal text-foreground-muted">· {grid.total} bindus</span>
              </summary>
              <div className="px-4 pb-4">
                <AstrologyDataTable
                  columns={[
                    {
                      id: "contributor",
                      label: "From",
                      rowHeader: true,
                      headerClassName: "whitespace-nowrap",
                      cell: (row) => row.contributor,
                    },
                    ...Array.from({ length: 12 }, (_, index) => ({
                      id: `sign-${index + 1}`,
                      label: getSignName(index + 1).slice(0, 3),
                      headerClassName: "whitespace-nowrap",
                      cellClassName: "tabular-nums",
                      cell: (row: (typeof grid.rows)[number]) =>
                        row.bindus[index + 1] === 1 ? (
                          <span className="text-premium">1</span>
                        ) : (
                          <span className="text-foreground-muted">·</span>
                        ),
                    })),
                    {
                      id: "total",
                      label: "Total",
                      cellClassName: "font-semibold tabular-nums",
                      cell: (row) => row.total,
                    },
                  ]}
                  rowKey={(row) => row.contributor}
                  rows={grid.rows}
                />
              </div>
            </details>
          );
        })}
        <p className="caption text-foreground-muted">
          Each column adds up to the planet&apos;s Bhinnashtakavarga above, by construction. The Trikona and
          Ekadhipatya reductions are not applied — those have variant readings and are not implemented.
        </p>
      </div>
    </div>
  );
}
