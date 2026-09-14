import { AstrologyDataTable, type AstrologyTableColumn } from "@/components/astrology/data-table";
import {
  IMPLEMENTED_BALAS,
  MISSING_BALAS,
  calculateBala,
  type BalaComponents,
} from "@/lib/astrology/charts/bala";
import { ChartDataError, type VedicChartData } from "@/lib/astrology/charts/types";

/**
 * Planetary strength, named component by component.
 *
 * The heading does not say Shadbala and the total column does not either,
 * because neither would be true: two of the six balas are absent. Calling a
 * partial sum by the whole system's name is the one thing this panel must not
 * do - a reader comparing it against another program would find it wrong and
 * have no way to see why.
 *
 * What is missing is listed underneath, with the reason. That is more useful
 * than a complete-looking number nobody can defend.
 */
const round = (value: number) => Math.round(value * 100) / 100;

export function BalaPanel({ chart }: { chart: VedicChartData }) {
  let rows: BalaComponents[];
  try {
    rows = calculateBala(chart);
  } catch (error) {
    if (error instanceof ChartDataError) {
      return (
        <p className="body-sm text-foreground-secondary">
          Planetary strength needs the ascendant&apos;s exact degree, which this calculation does not have.
        </p>
      );
    }
    throw error;
  }

  const columns: AstrologyTableColumn<BalaComponents>[] = [
    {
      id: "planet",
      label: "Planet",
      rowHeader: true,
      cell: (row) => <span className="font-semibold text-foreground">{row.planet}</span>,
    },
    { id: "house", label: "House", cellClassName: "tabular-nums", cell: (row) => row.house },
    { id: "naisargika", label: "Naisargika", cellClassName: "tabular-nums", cell: (row) => round(row.naisargika) },
    { id: "saptavargaja", label: "Saptavargaja", cellClassName: "tabular-nums", cell: (row) => round(row.saptavargaja) },
    { id: "uchcha", label: "Uchcha", cellClassName: "tabular-nums", cell: (row) => round(row.uchcha) },
    { id: "kendradi", label: "Kendradi", cellClassName: "tabular-nums", cell: (row) => round(row.kendradi) },
    { id: "dig", label: "Dig", cellClassName: "tabular-nums", cell: (row) => round(row.dig) },
    { id: "ojhayugma", label: "Ojha/Yugma", cellClassName: "tabular-nums", cell: (row) => round(row.ojhayugma) },
    { id: "drekkana", label: "Drekkana", cellClassName: "tabular-nums", cell: (row) => round(row.drekkana) },
    { id: "drik", label: "Drik", cellClassName: "tabular-nums", cell: (row) => round(row.drik) },
    {
      id: "partial",
      label: "Partial sum",
      cellClassName: "font-semibold tabular-nums",
      cell: (row) => round(row.partialTotal),
    },
  ];

  return (
    <div className="grid gap-4">
      <div>
        <h3 className="heading-sm">Planetary strength — partial</h3>
        <p className="mt-1 body-sm text-foreground-secondary">
          {IMPLEMENTED_BALAS.length} of the components that make up Shadbala, in Shashtiamsas
          (sixtieths). Scroll sideways to read across.
        </p>
      </div>

      <AstrologyDataTable columns={columns} rowKey={(row) => row.planet} rows={rows} />

      <div className="rounded-lg border border-warning/45 bg-warning/10 p-4">
        <p className="body-sm font-semibold text-warning">This is not Shadbala.</p>
        <p className="mt-1 caption text-foreground-secondary">
          The final column adds only the components listed above. It is not the six-fold strength and
          must not be compared against a Shadbala figure from elsewhere. Still missing:
        </p>
        <ul className="mt-2 grid gap-1">
          {MISSING_BALAS.map((missing) => (
            <li className="caption text-foreground-secondary" key={missing}>
              · {missing}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
