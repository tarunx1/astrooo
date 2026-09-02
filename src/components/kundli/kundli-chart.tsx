import type { KundliChartData } from "@/lib/kundli/types";

const cells = [
  { house: 1, x: 80, y: 20 },
  { house: 2, x: 145, y: 35 },
  { house: 3, x: 160, y: 95 },
  { house: 4, x: 145, y: 155 },
  { house: 5, x: 80, y: 170 },
  { house: 6, x: 20, y: 155 },
  { house: 7, x: 10, y: 95 },
  { house: 8, x: 20, y: 35 },
  { house: 9, x: 80, y: 70 },
  { house: 10, x: 115, y: 95 },
  { house: 11, x: 80, y: 120 },
  { house: 12, x: 45, y: 95 },
];

export function KundliChart({ data }: { data: KundliChartData }) {
  const houseMap = new Map(data.houses.map((house) => [house.house, house]));

  return (
    <figure className="rounded-lg border border-border bg-background p-4">
      <svg aria-labelledby="kundli-chart-title kundli-chart-desc" className="h-auto w-full text-premium" role="img" viewBox="0 0 200 200">
        <title id="kundli-chart-title">North Indian Kundli chart</title>
        <desc id="kundli-chart-desc">
          Houses one through twelve with signs and planet abbreviations from the calculated Kundli result.
        </desc>
        <rect fill="none" height="196" stroke="currentColor" strokeWidth="1.2" width="196" x="2" y="2" />
        <path d="M2 2 198 198M198 2 2 198M100 2 198 100 100 198 2 100Z" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.78" />
        {cells.map((cell) => {
          const house = houseMap.get(cell.house);
          return (
            <g key={cell.house}>
              <text fill="currentColor" fontSize="6" fontWeight="700" x={cell.x} y={cell.y}>
                {cell.house}
              </text>
              <text fill="var(--foreground)" fontSize="5.4" x={cell.x} y={cell.y + 9}>
                {house?.sign.slice(0, 3)}
              </text>
              <text fill="var(--foreground-secondary)" fontSize="4.8" x={cell.x} y={cell.y + 17}>
                {house?.planets.map((planet) => planet.slice(0, 2)).join(" ")}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-3 caption text-foreground-muted">North Indian chart view. Presentation only; calculations come from the provider layer.</figcaption>
    </figure>
  );
}
