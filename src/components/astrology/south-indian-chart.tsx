import { getHouseFromSign } from "@/lib/astrology/charts/houses";
import { layoutPlanetsInHouse, type PlanetLabelMode } from "@/lib/astrology/charts/labels";
import {
  SOUTH_INDIAN_CELL,
  SOUTH_INDIAN_SIGN_CELLS,
  SOUTH_INDIAN_VIEWBOX,
  cellCentre,
  cellRect,
} from "@/lib/astrology/charts/layouts/south-indian";
import { getSignName, normalizeSign } from "@/lib/astrology/charts/signs";
import { sortPlanetsForDisplay } from "@/lib/astrology/charts/houses";
import type { VedicChartData } from "@/lib/astrology/charts/types";

/**
 * South Indian chart.
 *
 * The mirror principle of the North Indian style: the signs are fixed to their
 * cells and the house numbers rotate. Aries always sits in the same place, and
 * changing the ascendant changes only which cell is house 1.
 *
 * Sharing the North Indian anchors here would silently produce a chart that is
 * wrong in a way that still looks plausible, so the two layouts deliberately
 * share nothing but the domain helpers.
 */
export type SouthIndianChartProps = {
  data: VedicChartData;
  showDegrees?: boolean;
  showRetrograde?: boolean;
  showAscendant?: boolean;
  planetLabelMode?: PlanetLabelMode;
  titleId: string;
};

export function SouthIndianChart({
  data,
  showDegrees = false,
  showRetrograde = true,
  showAscendant = true,
  planetLabelMode = "short",
  titleId,
}: SouthIndianChartProps) {
  const ascendant = normalizeSign(data.ascendantSign);

  return (
    <svg
      aria-labelledby={titleId}
      className="h-auto w-full text-foreground-muted"
      role="img"
      viewBox={`0 0 ${SOUTH_INDIAN_VIEWBOX} ${SOUTH_INDIAN_VIEWBOX}`}
    >
      <rect
        fill="none"
        height={SOUTH_INDIAN_VIEWBOX}
        stroke="currentColor"
        strokeWidth={3}
        width={SOUTH_INDIAN_VIEWBOX}
        x={0}
        y={0}
      />

      {SOUTH_INDIAN_SIGN_CELLS.map((cell) => {
        const rect = cellRect(cell);
        const centre = cellCentre(cell);
        const house = getHouseFromSign(cell.sign, ascendant);
        const planets = sortPlanetsForDisplay(
          data.planets.filter((planet) => normalizeSign(planet.sign) === cell.sign),
        );
        const { labels, fontSize } = layoutPlanetsInHouse(planets, centre, {
          mode: planetLabelMode,
          showDegrees,
          showRetrograde,
        });

        return (
          <g key={cell.sign}>
            <rect
              fill="none"
              height={rect.height}
              stroke="currentColor"
              strokeWidth={2}
              width={rect.width}
              x={rect.x}
              y={rect.y}
            />

            {/* House number, which is what moves in this style. */}
            <text
              fill="var(--premium)"
              fontSize={26}
              fontWeight={600}
              x={rect.x + 14}
              y={rect.y + 32}
            >
              {house}
            </text>

            <text
              fill="var(--foreground-muted)"
              fontSize={20}
              textAnchor="end"
              x={rect.x + rect.width - 14}
              y={rect.y + 32}
            >
              {getSignName(cell.sign).slice(0, 3)}
            </text>

            {showAscendant && house === 1 ? (
              <text
                fill="var(--foreground-muted)"
                fontSize={20}
                x={rect.x + 14}
                y={rect.y + rect.height - 16}
              >
                Asc
              </text>
            ) : null}

            {labels.map((label) => (
              <text
                fill="var(--foreground)"
                fontSize={Math.min(fontSize, SOUTH_INDIAN_CELL / 6)}
                key={label.planet.planet}
                textAnchor="middle"
                x={label.x}
                y={label.y}
              >
                {label.text}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
