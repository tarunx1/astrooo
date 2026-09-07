import { GocharTable } from "@/components/astrology/gochar-table";
import { VedicChart } from "@/components/astrology/vedic-chart";
import { createTransitChart } from "@/lib/astrology/charts/factory";
import { getSignName } from "@/lib/astrology/charts/signs";
import { getCurrentTransits } from "@/lib/astrology/tools-service";

/**
 * The Gochar view.
 *
 * Split out and suspended because it is the only chart on this page that is not
 * a function of the birth data alone - it needs where the planets are right
 * now. Keeping it behind its own boundary means a slow or failed provider
 * costs the Gochar tab and nothing else; the natal charts come from the stored
 * calculation and render without waiting for it.
 */
export async function GocharPanel({ moonSign, ascendantSign }: { moonSign: number; ascendantSign: number }) {
  const outcome = await getCurrentTransits();

  if (!outcome.ok) {
    return (
      <p className="body-sm text-foreground-secondary">
        Current planetary positions are unavailable right now, so Gochar cannot be shown. The natal charts are
        unaffected.
      </p>
    );
  }

  const gochar = createTransitChart({
    // Counted from the natal Moon, which is how Gochar is classically read.
    natalAscendantSign: moonSign,
    transits: outcome.value.positions,
    calculatedAt: outcome.value.at,
  });

  return (
    <div className="grid gap-5">
      <VedicChart data={gochar} label="Gochar: transits from the natal Moon" />
      <GocharTable ascendantSign={ascendantSign} moonSign={moonSign} transits={gochar} />
      <p className="caption text-foreground-muted">
        Positions for{" "}
        <time dateTime={outcome.value.at}>
          {new Date(outcome.value.at).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "UTC",
          })}{" "}
          UTC
        </time>
        , anchored to the top of the hour. Houses in the chart are counted from the natal Moon in{" "}
        {getSignName(moonSign)}.
      </p>
    </div>
  );
}
