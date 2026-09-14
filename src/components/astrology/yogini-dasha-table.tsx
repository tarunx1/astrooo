import { AstrologyDataTable, type AstrologyTableColumn } from "@/components/astrology/data-table";
import {
  YOGINI_CYCLE_YEARS,
  buildYoginiTimeline,
  type YoginiPeriod,
} from "@/lib/astrology/charts/yogini-dasha";

/**
 * Yogini dasha, kept apart from Vimshottari.
 *
 * The two systems share nothing but a dasha year. Yogini runs eight periods of
 * one to eight years for a thirty-six year turn, with no proportional
 * subdivision, so it is shown as a plain sequence rather than as a tree. Forcing
 * it into the Vimshottari layout would imply a structure it does not have.
 *
 * Periods that ended before the birth are dropped: the cycle is laid out from
 * where the first one truly began so the balance is honest, but nobody needs to
 * read a period that was over before they arrived.
 */
const formatDate = (date: Date) =>
  date.toLocaleDateString("en-GB", { year: "numeric", month: "short", timeZone: "UTC" });

export function YoginiDashaTable({
  birthISO,
  moonLongitude,
}: {
  birthISO: string;
  moonLongitude: number;
}) {
  const birth = new Date(birthISO);
  const timeline = buildYoginiTimeline(birth, moonLongitude);
  const periods = timeline.periods.filter((period) => period.end > birth);

  const columns: AstrologyTableColumn<YoginiPeriod>[] = [
    {
      id: "yogini",
      label: "Yogini",
      rowHeader: true,
      cell: (row) => <span className="font-semibold text-foreground">{row.yogini}</span>,
    },
    { id: "lord", label: "Lord", cell: (row) => row.lord },
    { id: "years", label: "Years", cellClassName: "tabular-nums", cell: (row) => row.years },
    {
      id: "from",
      label: "From",
      cellClassName: "whitespace-nowrap tabular-nums",
      cell: (row) => formatDate(row.start),
    },
    {
      id: "to",
      label: "To",
      cellClassName: "whitespace-nowrap tabular-nums",
      cell: (row) => formatDate(row.end),
    },
  ];

  return (
    <div className="mt-4 grid gap-2">
      <h3 className="body-sm font-semibold text-foreground">Yogini Dasha</h3>
      <p className="caption text-foreground-muted">
        Eight yoginis of one to eight years, a {YOGINI_CYCLE_YEARS}-year turn that simply repeats. Starting
        in {timeline.birthYogini}. This is a separate system from Vimshottari and is not a subdivision of it.
      </p>
      <AstrologyDataTable
        columns={columns}
        rowKey={(row) => `${row.yogini}-${row.start.toISOString()}`}
        rows={periods}
      />
    </div>
  );
}
