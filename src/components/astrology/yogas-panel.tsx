import { detectYogas } from "@/lib/astrology/charts/yogas";
import type { VedicChartData } from "@/lib/astrology/charts/types";
import { cn } from "@/lib/utils";

/**
 * Detected yogas, with the reason each one fired.
 *
 * Rules that did not fire are shown too, greyed, because "Gajakesari was
 * checked and is not present" is information and an absent row is not. It also
 * makes the limits of the engine visible: this list is what is checked, and
 * nothing outside it has been looked for.
 *
 * The evidence is the raw condition that matched. It is deliberately terse and
 * factual rather than prose - it exists so a reading can say why, and so a
 * disagreement can be settled by looking at the chart.
 */
export function YogasPanel({ chart }: { chart: VedicChartData }) {
  const yogas = detectYogas(chart);
  const found = yogas.filter((yoga) => yoga.present);

  return (
    <div className="grid gap-4">
      <div>
        <h3 className="heading-sm">Yogas</h3>
        <p className="mt-1 body-sm text-foreground-secondary">
          {found.length === 0
            ? "None of the rules below hold in this chart."
            : `${found.length} of ${yogas.length} rules hold in this chart.`}
        </p>
      </div>

      <ul className="grid gap-3">
        {yogas.map((yoga) => (
          <li
            className={cn(
              "rounded-lg border p-4",
              yoga.present ? "border-premium/40 bg-premium/5" : "border-border bg-surface-muted",
            )}
            key={yoga.name}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className={cn("body-sm font-semibold", yoga.present ? "text-premium" : "text-foreground-muted")}>
                {yoga.name}
              </p>
              <p className="caption text-foreground-muted">{yoga.present ? "Present" : "Not present"}</p>
            </div>
            <p className="mt-1 caption text-foreground-secondary">{yoga.definition}</p>
            {yoga.evidence.length > 0 ? (
              <p className="mt-2 font-mono caption text-foreground-muted">{yoga.evidence.join(" · ")}</p>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="caption text-foreground-muted">
        Only rules with tests are listed. Classical texts name hundreds of yogas, many with conflicting
        definitions; a short list that is right is worth more than a long one that is approximate.
      </p>
    </div>
  );
}
