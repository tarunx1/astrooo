import { AstrologyDataTable, type AstrologyTableColumn } from "@/components/astrology/data-table";
import {
  RELATIONSHIP_PLANETS,
  calculateRelationships,
  type CompoundRelation,
  type RelationshipPlanet,
} from "@/lib/astrology/charts/relationships";
import { calculateConditions, type PlanetaryCondition } from "@/lib/astrology/charts/dignity";
import { aspectHousesFor, calculateAspects } from "@/lib/astrology/charts/aspects";
import { calculateNavatara, type NavataraEntry } from "@/lib/astrology/charts/navatara";
import { getSignName } from "@/lib/astrology/charts/signs";
import { formatDegreeInSign } from "@/lib/astrology/charts/signs";
import type { VedicChartData } from "@/lib/astrology/charts/types";
import { cn } from "@/lib/utils";

/**
 * Planetary condition and the friendship matrix.
 *
 * Friend and enemy are technical terms here, not praise and blame, so the cells
 * are not coloured green and red. They are distinguished by weight and a single
 * accent instead: enough to scan forty-nine cells quickly, without implying that
 * a great enemy is bad news. What any of it means is interpretation, and this
 * table does not do interpretation.
 */

const ABBREVIATION: Record<CompoundRelation, string> = {
  "great friend": "GF",
  friend: "F",
  neutral: "N",
  enemy: "E",
  "great enemy": "GE",
};

const CELL_STYLE: Record<CompoundRelation, string> = {
  "great friend": "bg-premium/20 text-premium font-semibold",
  friend: "bg-premium/10 text-premium",
  neutral: "text-foreground-muted",
  enemy: "bg-surface-muted text-foreground-secondary",
  "great enemy": "bg-surface-muted text-foreground font-semibold",
};

export function RelationshipsPanel({ chart }: { chart: VedicChartData }) {
  const conditions = calculateConditions(chart);
  const cells = calculateRelationships(chart);

  const byPair = new Map(cells.map((cell) => [`${cell.from}:${cell.to}`, cell]));

  const conditionColumns: AstrologyTableColumn<PlanetaryCondition>[] = [
    {
      id: "planet",
      label: "Planet",
      rowHeader: true,
      cell: (row) => <span className="font-semibold text-foreground">{row.planet}</span>,
    },
    { id: "sign", label: "Sign", cell: (row) => getSignName(row.sign) },
    {
      id: "degree",
      label: "Degree",
      cellClassName: "tabular-nums",
      cell: (row) => formatDegreeInSign(row.degreeInSign),
    },
    { id: "lord", label: "Sign lord", cell: (row) => row.signLord },
    {
      id: "dignity",
      label: "Dignity",
      cell: (row) =>
        row.dignity ? (
          <span className={cn(row.deep && "font-semibold text-premium")}>
            {row.dignity}
            {row.deep ? " (exact)" : ""}
          </span>
        ) : (
          // The nodes own no sign, so they have no dignity to report. Saying so
          // is better than printing a dash that reads as "none".
          <span className="text-foreground-muted">not applicable</span>
        ),
    },
    {
      id: "nature",
      label: "Nature",
      cell: (row) => (
        <span className={row.natureConditional ? "text-foreground" : "text-foreground-secondary"}>
          {row.nature}
          {row.natureConditional ? <span className="text-foreground-muted"> (in context)</span> : null}
        </span>
      ),
    },
    {
      id: "avastha",
      label: "Avastha",
      cell: (row) =>
        row.avastha ?? <span className="text-foreground-muted">not applicable</span>,
    },
    {
      id: "state",
      label: "State",
      cell: (row) => {
        const states = [row.retrograde ? "Retrograde" : null, row.combust ? "Combust" : null].filter(
          Boolean,
        );
        return states.length > 0 ? states.join(" · ") : <span className="text-foreground-muted">Direct</span>;
      },
    },
  ];

  const { planets: planetAspects, houses: houseAspects } = calculateAspects(chart);

  // One row per planet that actually casts something, so the nodes do not
  // appear as empty rows implying they aspect nothing in this chart in
  // particular rather than by rule.
  const aspectRows = chart.planets
    .filter((planet) => aspectHousesFor(planet.planet).length > 0)
    .map((planet) => ({
      planet: planet.planet,
      casts: aspectHousesFor(planet.planet),
      houses: houseAspects.filter((aspect) => aspect.from === planet.planet).map((aspect) => aspect.house),
      onto: planetAspects.filter((aspect) => aspect.from === planet.planet),
    }));

  const aspectColumns: AstrologyTableColumn<(typeof aspectRows)[number]>[] = [
    {
      id: "planet",
      label: "Planet",
      rowHeader: true,
      cell: (row) => <span className="font-semibold text-foreground">{row.planet}</span>,
    },
    {
      id: "casts",
      label: "Aspects",
      cell: (row) => row.casts.map((house) => `${house}th`).join(", "),
    },
    {
      id: "houses",
      label: "Houses aspected",
      cellClassName: "tabular-nums",
      cell: (row) => row.houses.sort((a, b) => a - b).join(", "),
    },
    {
      id: "onto",
      label: "Planets aspected",
      cell: (row) =>
        row.onto.length > 0 ? (
          row.onto.map((aspect) => `${aspect.to} (${aspect.house}th)`).join(", ")
        ) : (
          <span className="text-foreground-muted">none</span>
        ),
    },
  ];

  const moon = chart.planets.find((planet) => planet.planet === "Moon");
  const navatara = moon ? calculateNavatara(moon.longitude) : null;

  const navataraColumns: AstrologyTableColumn<NavataraEntry>[] = [
    {
      id: "from",
      label: "#",
      rowHeader: true,
      cellClassName: "tabular-nums",
      cell: (row) => row.fromBirth,
    },
    { id: "nakshatra", label: "Nakshatra", cell: (row) => row.nakshatra },
    { id: "tara", label: "Tara", cell: (row) => row.tara },
    { id: "cycle", label: "Cycle", cellClassName: "tabular-nums", cell: (row) => row.cycle },
  ];

  type MatrixRow = { planet: RelationshipPlanet };
  const matrixRows: MatrixRow[] = RELATIONSHIP_PLANETS.map((planet) => ({ planet }));

  const matrixColumns: AstrologyTableColumn<MatrixRow>[] = [
    {
      id: "planet",
      label: "From \\ To",
      rowHeader: true,
      headerClassName: "whitespace-nowrap",
      cell: (row) => <span className="font-semibold text-foreground">{row.planet}</span>,
    },
    ...RELATIONSHIP_PLANETS.map((to) => ({
      id: to,
      label: to.slice(0, 2),
      headerClassName: "whitespace-nowrap",
      cell: (row: MatrixRow) => {
        if (row.planet === to) return <span className="text-foreground-muted">—</span>;

        const cell = byPair.get(`${row.planet}:${to}`);
        if (!cell) return null;

        return (
          <span
            className={cn("inline-block min-w-8 rounded px-1.5 py-0.5 text-center", CELL_STYLE[cell.compound])}
            // The compound value is the pair taken together, so the two halves
            // it came from are worth having without another table.
            title={`${row.planet} to ${to}: ${cell.compound} (natural ${cell.natural}, temporal ${cell.temporal})`}
          >
            {ABBREVIATION[cell.compound]}
          </span>
        );
      },
    })),
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h3 className="heading-sm">Planetary condition</h3>
        <p className="body-sm text-foreground-secondary">
          Where each planet stands in the sign it occupies. Dignity is a position, not a verdict.
        </p>
        <AstrologyDataTable
          columns={conditionColumns}
          rowKey={(row) => row.planet}
          rows={conditions}
        />
      </div>

      {navatara ? (
        <div className="grid gap-2">
          <h3 className="heading-sm">Navatara</h3>
          <p className="body-sm text-foreground-secondary">
            The twenty-seven nakshatras counted from {navatara.birthNakshatra}, the birth star, which is
            itself the first — Janma. Every ninth returns to the same tara, so the cycle runs three times.
          </p>
          <AstrologyDataTable
            columns={navataraColumns}
            rowKey={(row) => String(row.number)}
            rows={navatara.entries}
          />
          <p className="caption text-foreground-muted">
            A tara is a position in a cycle. The traditional names carry strong associations; what any of
            them means for a reading is interpretation, not part of this count.
          </p>
        </div>
      ) : null}

      <div className="grid gap-2">
        <h3 className="heading-sm">Aspects</h3>
        <p className="body-sm text-foreground-secondary">
          Graha drishti, counted in whole signs. Every planet aspects the seventh from itself; Mars,
          Jupiter and Saturn each have two more.
        </p>
        <AstrologyDataTable columns={aspectColumns} rowKey={(row) => row.planet} rows={aspectRows} />
        <p className="caption text-foreground-muted">
          Rahu and Ketu cast no aspect in the classical rule and are not listed as aspecting, though they
          can be aspected. Degrees play no part: a Vedic aspect lands on a whole sign or it does not.
        </p>
      </div>

      <div className="grid gap-2">
        <h3 className="heading-sm">Friendship</h3>
        <p className="body-sm text-foreground-secondary">
          The compound relationship — natural and temporal taken together — read from the row planet to
          the column planet. The table is not symmetric: temporal friendship depends on which planet you
          count from.
        </p>
        <AstrologyDataTable columns={matrixColumns} rowKey={(row) => row.planet} rows={matrixRows} />
        <p className="caption text-foreground-muted">
          GF great friend · F friend · N neutral · E enemy · GE great enemy. Rahu and Ketu are not in the
          classical friendship table and are not shown. Hover a cell for the natural and temporal halves.
        </p>
      </div>
    </div>
  );
}
