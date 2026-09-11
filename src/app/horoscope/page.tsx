import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, Section, SectionHeader } from "@/components/layout/primitives";
import { Card } from "@/components/ui/card";
import { ToolBreadcrumbSchema } from "@/components/tools/calculator-shell";
import { SIGN_PROFILES } from "@/lib/astrology/horoscope";
import { brand } from "@/config/brand";

const DESCRIPTION =
  "Guides to the twelve sidereal zodiac signs, their rulers and how Vedic astrology reads transits. Find your Moon sign first — it matters more than your Sun sign.";

export const metadata: Metadata = {
  title: "Horoscope & Zodiac Signs",
  description: DESCRIPTION,
  alternates: { canonical: `${brand.url}/horoscope` },
  openGraph: { title: "Horoscope & Zodiac Signs | Tarun Astro", description: DESCRIPTION, url: `${brand.url}/horoscope` },
};

const BREADCRUMB = [{ label: "Home", href: "/" }, { label: "Horoscope" }];

export default function HoroscopePage() {
  return (
    <>
      <ToolBreadcrumbSchema items={BREADCRUMB} />
      <Section className="star-field">
        <PageContainer className="px-0">
          <SectionHeader
            text="Reference guides to each sidereal sign. In Vedic astrology a horoscope is read from your Moon sign and your Lagna, not from the Sun sign used in newspaper columns."
            title="Horoscope & Zodiac Signs"
          />

          <Card className="mb-8 p-5">
            <h2 className="heading-sm">We do not publish daily horoscopes yet</h2>
            <p className="mt-2 body-sm text-foreground-secondary">
              A daily forecast worth reading has to be grounded in real transit data rather than generated filler.
              The transit layer is built and the editorial layer is not, so rather than auto-publish thin pages we
              are keeping this section to sign guides until daily content is genuinely ready.
            </p>
            <p className="mt-3 body-sm text-foreground-secondary">
              In the meantime,{" "}
              <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/calculators/moon-sign" prefetch={false}>
                find your Moon sign
              </Link>{" "}
              — it is the placement a Vedic reading actually starts from.
            </p>
          </Card>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SIGN_PROFILES.map((profile) => (
              <li key={profile.slug}>
                <Card className="h-full" variant="interactive">
                  <Link
                    className="flex h-full flex-col gap-2 p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                    href={`/horoscope/${profile.slug}`}
                    prefetch={false}
                  >
                    <h2 className="heading-sm">
                      {profile.sign} <span className="text-foreground-muted">· {profile.sanskritName}</span>
                    </h2>
                    <p className="caption text-foreground-muted">
                      {profile.symbol} · Ruled by {profile.rulingPlanet} · {profile.element}
                    </p>
                    <p className="body-sm text-foreground-secondary">{profile.overview}</p>
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </PageContainer>
      </Section>
    </>
  );
}
