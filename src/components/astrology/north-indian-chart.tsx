import { buildHouses } from "@/lib/astrology/charts/houses";
import { layoutPlanetsInHouse, type PlanetLabelMode } from "@/lib/astrology/charts/labels";
import {
  houseHalfWidthAt,
  NORTH_INDIAN_HOUSE_ANCHORS,
  NORTH_INDIAN_PATHS,
  NORTH_INDIAN_VIEWBOX,
  SIGN_CLEARANCE,
  signAnchorFor,
} from "@/lib/astrology/charts/layouts/north-indian";
import type { VedicChartData } from "@/lib/astrology/charts/types";

/**
 * North Indian chart.
 *
 * Pure SVG and a pure function of its data: no client JavaScript, no canvas, no
 * generated image. That is what lets the same component serve a page, a PDF and
 * a print without a second implementation, and it stays sharp at any size.
 *
 * Draws only what it is given. House and sign placement is decided in the chart
 * domain, so this component never works out where a planet belongs - it would
 * be far too easy to end up with geometry that quietly disagrees with the
 * numbers shown beside it.
 */
export type NorthIndianChartProps = {
  data: VedicChartData;
  showDegrees?: boolean;
  showRetrograde?: boolean;
  showAscendant?: boolean;
  planetLabelMode?: PlanetLabelMode;
  titleId: string;
};

export function NorthIndianChart({
  data,
  showDegrees = false,
  showRetrograde = true,
  showAscendant = true,
  planetLabelMode = "short",
  titleId,
}: NorthIndianChartProps) {
  const houses = buildHouses(data);

  return (
    <svg
      aria-labelledby={titleId}
      className="h-auto w-full text-foreground-muted"
      role="img"
      viewBox={`0 0 ${NORTH_INDIAN_VIEWBOX} ${NORTH_INDIAN_VIEWBOX}`}
    >
      {/* Frame. currentColor so the chart follows the surrounding text colour
          and prints legibly on white without a separate print stylesheet. */}
      <g fill="none" stroke="currentColor" strokeWidth={3}>
        <path d={NORTH_INDIAN_PATHS.border} />
        <path d={NORTH_INDIAN_PATHS.diagonals} strokeWidth={2} />
        <path d={NORTH_INDIAN_PATHS.diamond} strokeWidth={2} />
      </g>

      {NORTH_INDIAN_HOUSE_ANCHORS.map((anchor) => {
        const house = houses[anchor.house - 1];
        const signPosition = signAnchorFor(anchor);
        const { labels, fontSize } = layoutPlanetsInHouse(house.planets, anchor, {
          mode: planetLabelMode,
          showDegrees,
          showRetrograde,
          // Keeps a crowded house from growing up into its own sign number.
          minTop: signPosition.y + SIGN_CLEARANCE,
          // The shape itself, so a long label shrinks rather than crossing into
          // the neighbouring house - where it would read as a placement.
          fitWidth: (y: number) => houseHalfWidthAt(anchor.house, y),
        });

        return (
          <g key={anchor.house}>
            {/* The sign occupying this house. Numbers, as the style expects. */}
            <text
              fill="var(--premium)"
              fontSize={30}
              fontWeight={600}
              textAnchor="middle"
              x={signPosition.x}
              y={signPosition.y}
            >
              {house.sign}
            </text>

            {showAscendant && anchor.house === 1 ? (
              <text
                fill="var(--foreground-muted)"
                fontSize={22}
                textAnchor="middle"
                x={signPosition.x}
                y={signPosition.y + 26}
              >
                Asc
              </text>
            ) : null}

            {labels.map((label) => (
              <text
                fill="var(--foreground)"
                fontSize={fontSize}
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
