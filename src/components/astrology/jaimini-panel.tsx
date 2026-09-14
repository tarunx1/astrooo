import { AstrologyDataTable, type AstrologyTableColumn } from "@/components/astrology/data-table";
import {
  calculateArudhaPadas,
  calculateCharaKarakas,
  calculateKarakamsa,
  type ArudhaPada,
  type CharaKarakaAssignment,
} from "@/lib/astrology/charts/jaimini";
import { VedicChart } from "@/components/astrology/vedic-chart";
import { createDivisionalChart } from "@/lib/astrology/charts/factory";
import { formatDegreeInSign, getSignName } from "@/lib/astrology/charts/signs";
import type { VedicChartData } from "@/lib/astrology/charts/types";

/**
 * The Jaimini view: chara karakas and arudha padas.
 *
 * Both are rankings and reflections, not readings. The karaka names translate
 * to relationships - Darakaraka is the "spouse significator" - and none of that
 * is spelled out here, because what a karaka signifies is a matter for a
 * reading and the table's job is to say which planet holds it.
 */

/** A1 and A12 have names of their own; the rest go by number. */
function padaLabel(house: number): string {
  if (house === 1) return "A1 — Arudha Lagna";
  if (house === 12) return "A12 — Upapada";
  return `A${house}`;
}

export function JaiminiPanel({ chart }: { chart: VedicChartData }) {
  const karakas = calculateCharaKarakas(chart);
  const padas = calculateArudhaPadas(chart);

  // Both charts are the Atmakaraka's navamsa sign read as a lagna - over the
  // Rashi for Karakamsa, over the Navamsa for Swamsa. Nothing is recalculated;
  // only the reference point moves, which is the whole of the technique.
  const karakamsa = calculateKarakamsa(chart);
  const karakamsaChart = { ...chart, chartType: "KARAKAMSA", ascendantSign: karakamsa.sign };
  const navamsa =
    typeof chart.ascendantLongitude === "number" ? createDivisionalChart(chart, 9) : null;
  const swamsaChart = navamsa
    ? { ...navamsa, chartType: "SWAMSA", ascendantSign: karakamsa.sign }
    : null;

  const karakaColumns: AstrologyTableColumn<CharaKarakaAssignment>[] = [
    {
      id: "karaka",
      label: "Karaka",
      rowHeader: true,
      cell: (row) => <span className="font-semibold text-foreground">{row.karaka}</span>,
    },
    { id: "planet", label: "Planet", cell: (row) => row.planet },
    {
      id: "degree",
      label: "Degree in sign",
      cellClassName: "tabular-nums",
      cell: (row) => formatDegreeInSign(row.degreeInSign),
    },
    {
      id: "ranking",
      label: "Ranked on",
      cellClassName: "tabular-nums",
      cell: (row) =>
        row.planet === "Rahu" ? (
          // Worth showing rather than hiding: the number the ranking used is
          // not the number in the previous column, and that looks like an error
          // unless the reversal is visible.
          <span title="Rahu is counted in reverse: 30 minus its degree.">
            {formatDegreeInSign(row.rankingDegree)} (reversed)
          </span>
        ) : (
          formatDegreeInSign(row.rankingDegree)
        ),
    },
  ];

  const padaColumns: AstrologyTableColumn<ArudhaPada>[] = [
    {
      id: "pada",
      label: "Pada",
      rowHeader: true,
      headerClassName: "whitespace-nowrap",
      cell: (row) => <span className="font-semibold text-foreground">{padaLabel(row.house)}</span>,
    },
    { id: "house", label: "House sign", cell: (row) => getSignName(row.houseSign) },
    { id: "lord", label: "Lord", cell: (row) => `${row.lord} in ${getSignName(row.lordSign)}` },
    {
      id: "sign",
      label: "Pada sign",
      cell: (row) => (
        <span className="font-semibold text-foreground">
          {getSignName(row.sign)}
          {row.adjusted ? <span className="ml-1 caption text-foreground-muted">(moved)</span> : null}
        </span>
      ),
    },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h3 className="heading-sm">Chara Karakas</h3>
        <p className="body-sm text-foreground-secondary">
          The eight planets ranked by how far they have travelled through their sign. The furthest is the
          Atmakaraka.
        </p>
        <AstrologyDataTable columns={karakaColumns} rowKey={(row) => row.karaka} rows={karakas} />
        <p className="caption text-foreground-muted">
          This is the eight-karaka scheme, which includes Rahu — counted in reverse, since it moves
          backwards through the zodiac. Ketu takes no karaka. A seven-karaka scheme excluding Rahu is also
          current and gives different answers; it is not used here.
        </p>
      </div>

      <div className="grid gap-2">
        <h3 className="heading-sm">Karakamsa and Swamsa</h3>
        <p className="body-sm text-foreground-secondary">
          {karakamsa.atmakaraka} is the Atmakaraka, and its Navamsa sign is {getSignName(karakamsa.sign)}.
          That sign read as the lagna of the Rashi chart is the Karakamsa; read as the lagna of the
          Navamsa it is the Swamsa.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <p className="caption font-semibold text-foreground">Karakamsa (over the Rashi)</p>
            <VedicChart data={karakamsaChart} label="Karakamsa chart" />
          </div>
          {swamsaChart ? (
            <div className="grid gap-2">
              <p className="caption font-semibold text-foreground">Swamsa (over the Navamsa)</p>
              <VedicChart data={swamsaChart} label="Swamsa chart" />
            </div>
          ) : null}
        </div>
        <p className="caption text-foreground-muted">
          These two names are used inconsistently in the literature and some authors swap them. The
          definitions above are the ones this software uses.
        </p>
      </div>

      <div className="grid gap-2">
        <h3 className="heading-sm">Arudha Padas</h3>
        <p className="body-sm text-foreground-secondary">
          Count from a house to its lord, then the same distance again from the lord. A1 is the Arudha
          Lagna and A12 the Upapada.
        </p>
        <AstrologyDataTable columns={padaColumns} rowKey={(row) => String(row.house)} rows={padas} />
        <p className="caption text-foreground-muted">
          A pada marked &ldquo;moved&rdquo; landed on its own house or the seventh from it, where a
          reflection cannot rest, and was carried to the tenth from there.
        </p>
      </div>
    </div>
  );
}
