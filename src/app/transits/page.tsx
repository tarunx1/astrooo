import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, Section } from "@/components/layout/primitives";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { ToolApplicationSchema, ToolBreadcrumbSchema } from "@/components/tools/calculator-shell";
import { getCurrentTransits } from "@/lib/astrology/tools-service";
import { brand } from "@/config/brand";

const DESCRIPTION =
  "Where the nine planets are right now in the sidereal zodiac, calculated with the Lahiri ayanamsa. Deterministic positions, not generated predictions.";

export const metadata: Metadata = {
  title: "Current Planetary Transits",
  description: DESCRIPTION,
  alternates: { canonical: `${brand.url}/transits` },
  openGraph: { title: "Current Planetary Transits | Ravish Astro", description: DESCRIPTION, url: `${brand.url}/transits` },
};

const BREADCRUMB = [{ label: "Home", href: "/" }, { label: "Transits" }];

/**
 * Traditional significations. Static reference content about each planet, kept
 * deliberately separate from the calculated positions above it.
 */
const PLANET_MEANINGS: Record<string, string> = {
  Sun: "Authority, vitality and the sense of self. Traditionally read for father, status and health.",
  Moon: "Mind, emotion and memory. The most important placement in Vedic astrology, and the basis of the dasha system.",
  Mars: "Drive, courage and conflict. Read for siblings, property and physical energy.",
  Mercury: "Communication, analysis and commerce. Read for learning, speech and trade.",
  Jupiter: "Wisdom, growth and guidance. Traditionally the most benefic influence, read for teachers and children.",
  Venus: "Relationship, comfort and the arts. Read for marriage, beauty and material pleasure.",
  Saturn: "Discipline, delay and endurance. Read for work, responsibility and the slow lessons of time.",
  Rahu: "The north lunar node. Read for ambition, obsession and unconventional paths.",
  Ketu: "The south lunar node. Read for detachment, insight and things released.",
};

export default async function TransitsPage() {
  const outcome = await getCurrentTransits();

  return (
    <>
      <ToolApplicationSchema description={DESCRIPTION} name="Current Planetary Transits" path="/transits" />
      <ToolBreadcrumbSchema items={BREADCRUMB} />

      <Section className="star-field">
        <PageContainer className="px-0">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-2 caption text-foreground-muted">
              <li>
                <Link className="hover:text-foreground" href="/" prefetch={false}>
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-foreground-secondary">
                Transits
              </li>
            </ol>
          </nav>

          <h1 className="heading-xl">Current Planetary Transits</h1>
          <p className="mt-4 max-w-[var(--container-sm)] body-lg text-foreground-secondary">
            Where the nine planets sit in the sidereal zodiac right now. These are calculated positions, not a
            forecast.
          </p>

          {!outcome.ok ? (
            <div className="mt-8">
              <ErrorState message={outcome.message} title="Transits are unavailable" />
            </div>
          ) : (
            <>
              <Card className="mt-8 p-4">
                <p className="body-sm text-foreground-secondary">
                  Calculated for{" "}
                  <time dateTime={outcome.value.at}>
                    {new Date(outcome.value.at).toLocaleString("en-IN", {
                      dateStyle: "full",
                      timeStyle: "short",
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                  , using the {outcome.value.calculationMetadata.ayanamsa} ayanamsa on a sidereal zodiac.
                </p>
                <p className="mt-2 caption text-foreground-muted">
                  Positions are anchored to the top of the current hour in UTC so this page is stable and shareable.
                  Planetary longitudes are the same worldwide; only the houses they fall in depend on your own birth
                  details.
                </p>
              </Card>

              <section aria-labelledby="positions-heading" className="mt-8">
                <h2 className="heading-md" id="positions-heading">
                  Positions
                </h2>

                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {outcome.value.positions.map((position) => (
                    <li key={position.planet}>
                      <Card className="h-full p-5" variant="astrology">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="heading-sm">{position.planet}</h3>
                          {position.retrograde ? (
                            <span className="rounded-full border border-warning/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
                              Retrograde
                            </span>
                          ) : null}
                        </div>

                        <dl className="mt-3 grid gap-1.5">
                          <div className="flex justify-between gap-3">
                            <dt className="caption text-foreground-muted">Sign</dt>
                            <dd className="body-sm font-semibold text-foreground">{position.sign}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="caption text-foreground-muted">Degree</dt>
                            <dd className="body-sm text-foreground">{position.degreeInSign}°</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="caption text-foreground-muted">Nakshatra</dt>
                            <dd className="body-sm text-foreground">{position.nakshatra}</dd>
                          </div>
                        </dl>

                        {/* Static reference material, clearly separated from the calculated values above. */}
                        <p className="mt-3 border-t border-border pt-3 caption text-foreground-muted">
                          {PLANET_MEANINGS[position.planet] ?? ""}
                        </p>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          <section aria-labelledby="about-heading" className="mt-14 grid gap-4">
            <h2 className="heading-md" id="about-heading">
              How to read this
            </h2>
            <div className="grid gap-3 body-md text-foreground-secondary">
              <p>
                A transit is simply where a planet is now, as opposed to where it was when you were born. Vedic
                astrology reads transits against your natal chart — particularly against your Moon sign — rather than
                in isolation. That reading is called Gochar, and the{" "}
                <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/kundli" prefetch={false}>
                  free Kundli
                </Link>{" "}
                includes it: the same positions shown here, placed in the houses they fall in for your own birth
                details.
              </p>
              <p>
                The descriptions beside each planet are traditional significations of that planet in general. They are
                fixed reference material, not a statement about you and not a daily forecast. Nothing on this page is
                generated by a language model.
              </p>
              <p>
                To see what a transit means for your own chart, start with your{" "}
                <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/calculators/moon-sign" prefetch={false}>
                  Moon sign
                </Link>
                , or check whether Saturn is currently crossing it with the{" "}
                <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/calculators/sade-sati" prefetch={false}>
                  Sade Sati calculator
                </Link>
                .
              </p>
            </div>
          </section>
        </PageContainer>
      </Section>
    </>
  );
}
