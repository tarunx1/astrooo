import { AstrologyDataTable, type AstrologyTableColumn } from "@/components/astrology/data-table";
import { calculateRulingPlanets, type RulingPlanet } from "@/lib/astrology/kp/ruling-planets";
import type { KpChart } from "@/lib/astrology/kp/chart";

/**
 * The ruling planets for the moment of birth.
 *
 * A planet named by more than one source is stronger for it, so the count is
 * kept rather than collapsed. "Venus appears three times" is the substance of
 * the technique, and a plain list of unique names throws it away.
 */
const SOURCE_LABELS: Record<string, string> = {
  "ascendant-sign-lord": "Ascendant sign lord",
  "ascendant-star-lord": "Ascendant star lord",
  "ascendant-sub-lord": "Ascendant sub lord",
  "moon-sign-lord": "Moon sign lord",
  "moon-star-lord": "Moon star lord",
  "moon-sub-lord": "Moon sub lord",
  "day-lord": "Day lord",
};

export function RulingPlanetsTable({ chart }: { chart: KpChart }) {
  const { planets, weekday, dayLord } = calculateRulingPlanets(chart);

  const columns: AstrologyTableColumn<RulingPlanet>[] = [
    {
      id: "planet",
      label: "Planet",
      rowHeader: true,
      cell: (row) => <span className="font-semibold text-foreground">{row.planet}</span>,
    },
    {
      id: "strength",
      label: "Times named",
      cellClassName: "tabular-nums",
      cell: (row) => row.strength,
    },
    {
      id: "sources",
      label: "From",
      cell: (row) => row.sources.map((source) => SOURCE_LABELS[source] ?? source).join(", "),
    },
  ];

  return (
    <section className="grid gap-2">
      <h3 className="body-sm font-semibold text-foreground">Ruling Planets</h3>
      <p className="caption text-foreground-muted">
        The lords governing the moment of birth, from seven sources: the Ascendant&apos;s sign, star and
        sub lords, the Moon&apos;s, and the lord of the weekday — {weekday}, ruled by {dayLord}.
      </p>
      <AstrologyDataTable columns={columns} rowKey={(row) => row.planet} rows={planets} />
      <p className="caption text-foreground-muted">
        This is the five-source form of the rule. Some practitioners add a node occupying a ruling
        planet&apos;s sign, or the lord of the hora; neither is included here, since both are elaborations
        that are not universally applied.
      </p>
    </section>
  );
}
