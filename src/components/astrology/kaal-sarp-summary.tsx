import { AstrologyStatusCard } from "@/components/astrology/status-card";
import { calculateKaalSarp } from "@/lib/astrology/charts/kaal-sarp";
import { ChartDataError, type VedicChartData } from "@/lib/astrology/charts/types";

/**
 * Kaal Sarp, stated as a fact and nothing more.
 *
 * The yoga has a fearsome reputation and the calculation has none: every planet
 * is inside the nodal axis or it is not. What is written here says which, names
 * the form when it applies, and stops. No remedy is suggested and no severity
 * is implied, because neither follows from the arithmetic.
 */
export function KaalSarpSummary({ chart }: { chart: VedicChartData }) {
  let result;
  try {
    result = calculateKaalSarp(chart);
  } catch (error) {
    if (error instanceof ChartDataError) return null; // Nodes absent: say nothing.
    throw error;
  }

  const status = result.present
    ? `Present — ${result.name} Kaal Sarp`
    : result.mirrored
      ? "Not present (mirrored axis)"
      : "Not present";

  return (
    <AstrologyStatusCard status={status} title="Kaal Sarp" tone={result.present ? "warning" : "success"}>
      {result.present ? (
        <>
          Every planet falls in the half of the chart running forward from Rahu to Ketu. Rahu occupies the{" "}
          {result.rahuHouse}
          {result.rahuHouse === 1 ? "st" : result.rahuHouse === 2 ? "nd" : result.rahuHouse === 3 ? "rd" : "th"}{" "}
          house, which is the form traditionally named {result.name}.
        </>
      ) : result.mirrored ? (
        <>
          Every planet falls in the opposite half, running forward from Ketu to Rahu. Several authors treat
          that as its own configuration rather than as Kaal Sarp, so it is reported separately here.
        </>
      ) : (
        <>
          {result.outside.length === 1
            ? `${result.outside[0]} falls outside`
            : `${result.outside.slice(0, -1).join(", ")} and ${result.outside.at(-1)} fall outside`}{" "}
          the arc from Rahu to Ketu, so the planets are not hemmed inside the nodal axis.
        </>
      )}
    </AstrologyStatusCard>
  );
}
