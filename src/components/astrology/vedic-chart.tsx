import { useId } from "react";
import { NorthIndianChart } from "@/components/astrology/north-indian-chart";
import { SouthIndianChart } from "@/components/astrology/south-indian-chart";
import { buildHouses } from "@/lib/astrology/charts/houses";
import { PLANET_ABBREVIATIONS, type PlanetLabelMode } from "@/lib/astrology/charts/labels";
import { getSignName } from "@/lib/astrology/charts/signs";
import type { VedicChartData } from "@/lib/astrology/charts/types";
import { cn } from "@/lib/utils";

/**
 * A Vedic chart, in either traditional style.
 *
 * One component for every chart in the product - Rashi, Navamsa, Moon, and
 * whatever divisions come later - because none of them differ in anything the
 * renderer can see. A D9 is a set of signs and houses exactly as a D1 is.
 *
 * The SVG carries the picture and a visually hidden list carries the same
 * information as text. A chart is meaning, not decoration, so a screen reader
 * gets the placements rather than a description of a square.
 */
export type VedicChartProps = {
  data: VedicChartData;
  layout?: "north" | "south";
  /** Names the chart for assistive technology, e.g. "D1 Rashi chart". */
  label: string;
  showDegrees?: boolean;
  showRetrograde?: boolean;
  showAscendant?: boolean;
  planetLabelMode?: PlanetLabelMode;
  className?: string;
};

export function VedicChart({
  data,
  layout = "north",
  label,
  showDegrees = false,
  showRetrograde = true,
  showAscendant = true,
  planetLabelMode = "short",
  className,
}: VedicChartProps) {
  const titleId = useId();
  const houses = buildHouses(data);
  const Chart = layout === "south" ? SouthIndianChart : NorthIndianChart;

  return (
    <figure className={cn("grid gap-3", className)}>
      {/* Referenced by the SVG's aria-labelledby, so the picture is named
          rather than announced as an unlabelled graphic. */}
      <span className="sr-only" id={titleId}>
        {label}. {getSignName(data.ascendantSign)} ascendant.
      </span>

      <div className="mx-auto w-full max-w-md">
        <Chart
          data={data}
          planetLabelMode={planetLabelMode}
          showAscendant={showAscendant}
          showDegrees={showDegrees}
          showRetrograde={showRetrograde}
          titleId={titleId}
        />
      </div>

      {/* The same placements as text. Not a summary of the image: the actual
          content, for anyone who cannot use the picture. */}
      <ul className="sr-only">
        {houses.map((house) => (
          <li key={house.house}>
            House {house.house}, {house.signName}:{" "}
            {house.planets.length === 0
              ? "no planets"
              : house.planets
                  .map(
                    (planet) =>
                      `${planet.planet}${planet.retrograde && showRetrograde ? " retrograde" : ""}`,
                  )
                  .join(", ")}
          </li>
        ))}
      </ul>

      <figcaption className="caption text-center text-foreground-muted">
        {label} · {layout === "south" ? "South" : "North"} Indian style ·{" "}
        {Object.entries(PLANET_ABBREVIATIONS)
          .slice(0, 3)
          .map(([name, abbreviation]) => `${abbreviation} ${name}`)
          .join(", ")}
        , and so on
      </figcaption>
    </figure>
  );
}
