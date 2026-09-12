import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, Section } from "@/components/layout/primitives";
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

const ZODIAC_GLYPHS: Record<string, string> = {
  Aries: "♈",
  Taurus: "♉",
  Gemini: "♊",
  Cancer: "♋",
  Leo: "♌",
  Virgo: "♍",
  Libra: "♎",
  Scorpio: "♏",
  Sagittarius: "♐",
  Capricorn: "♑",
  Aquarius: "♒",
  Pisces: "♓",
};

export default function HoroscopePage() {
  return (
    <>
      <ToolBreadcrumbSchema items={BREADCRUMB} />
      <Section className="star-field">
        <PageContainer className="px-0">
          <div className="max-w-3xl">
            <p className="caption uppercase tracking-[0.18em] text-premium">Sidereal sign guide</p>
            <h1 className="mt-3 heading-xl">Horoscope & Zodiac Signs</h1>
            <p className="mt-4 max-w-[42rem] body-lg text-foreground-secondary">
              Reference guides to each sidereal sign. In Vedic astrology, readings begin with your Moon sign and Lagna.
            </p>
          </div>

          <Card className="mt-8 max-w-2xl border-border/65 bg-surface/70 p-4 shadow-[var(--shadow-sm)]">
            <h2 className="heading-sm">We do not publish daily horoscopes yet</h2>
            <p className="mt-2 body-sm text-foreground-secondary">
              Daily forecasts need real transit data and editorial review. Until that layer is ready, this section stays focused on sign guides.
            </p>
            <p className="mt-3 body-sm text-foreground-secondary">
              In the meantime,{" "}
              <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/calculators/moon-sign" prefetch={false}>
                find your Moon sign
              </Link>{" "}
              — it is the placement a Vedic reading actually starts from.
            </p>
          </Card>

          <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SIGN_PROFILES.map((profile) => (
              <li key={profile.slug}>
                <Card className="h-full border-border/60 bg-surface/62 shadow-none transition hover:border-premium/50 hover:bg-surface/80">
                  <Link
                    className="flex h-full flex-col gap-2 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-premium"
                    href={`/horoscope/${profile.slug}`}
                    prefetch={false}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-foreground">{profile.sign}</h2>
                        <p className="caption text-premium">{profile.sanskritName}</p>
                      </div>
                      <span className="font-display text-2xl text-premium">{ZODIAC_GLYPHS[profile.sign]}</span>
                    </div>
                    <p className="caption text-foreground-muted">
                      Ruled by {profile.rulingPlanet} · {profile.element}
                    </p>
                    <p className="line-clamp-2 body-sm text-foreground-secondary">{profile.overview}</p>
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
