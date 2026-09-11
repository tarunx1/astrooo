import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer, Section } from "@/components/layout/primitives";
import { Card } from "@/components/ui/card";
import { ToolBreadcrumbSchema } from "@/components/tools/calculator-shell";
import { SIGN_PROFILES, getSignProfile } from "@/lib/astrology/horoscope";
import { brand } from "@/config/brand";

type Params = { params: Promise<{ sign: string }> };

export function generateStaticParams() {
  return SIGN_PROFILES.map((profile) => ({ sign: profile.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { sign } = await params;
  const profile = getSignProfile(sign);
  if (!profile) return { title: "Sign not found" };

  const description = `${profile.sign} (${profile.sanskritName}) in Vedic astrology: ruling planet ${profile.rulingPlanet}, ${profile.element} element, ${profile.modality} modality, and how the sidereal sign differs from the Western one.`;

  return {
    title: `${profile.sign} (${profile.sanskritName}) | Vedic Zodiac Guide`,
    description,
    alternates: { canonical: `${brand.url}/horoscope/${profile.slug}` },
    openGraph: { title: `${profile.sign} | Tarun Astro`, description, url: `${brand.url}/horoscope/${profile.slug}` },
  };
}

export default async function SignPage({ params }: Params) {
  const { sign } = await params;
  const profile = getSignProfile(sign);
  if (!profile) notFound();

  const breadcrumb = [
    { label: "Home", href: "/" },
    { label: "Horoscope", href: "/horoscope" },
    { label: profile.sign },
  ];

  return (
    <>
      <ToolBreadcrumbSchema items={breadcrumb} />
      <Section className="star-field">
        <PageContainer className="px-0">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-2 caption text-foreground-muted">
              {breadcrumb.map((crumb, index) => (
                <li className="flex items-center gap-2" key={crumb.label}>
                  {index > 0 ? <span aria-hidden="true">/</span> : null}
                  {crumb.href ? (
                    <Link className="hover:text-foreground" href={crumb.href} prefetch={false}>
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-foreground-secondary">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          <h1 className="heading-xl">
            {profile.sign} <span className="text-foreground-muted">· {profile.sanskritName}</span>
          </h1>
          <p className="mt-4 max-w-[var(--container-sm)] body-lg text-foreground-secondary">{profile.overview}</p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Ruling planet", value: profile.rulingPlanet },
              { label: "Element", value: profile.element },
              { label: "Modality", value: profile.modality },
              { label: "Symbol", value: profile.symbol },
            ].map((item) => (
              <Card className="p-5" key={item.label}>
                <p className="caption text-foreground-muted">{item.label}</p>
                <p className="mt-1 heading-sm">{item.value}</p>
              </Card>
            ))}
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            <section aria-labelledby="traits-heading">
              <h2 className="heading-md" id="traits-heading">Traditional associations</h2>
              <p className="mt-2 body-sm text-foreground-secondary">
                These are the qualities classical texts associate with the sign itself. They are not a statement about
                any individual: a real reading depends on the whole chart.
              </p>
              <ul className="mt-4 grid gap-2">
                {profile.traditionalTraits.map((trait) => (
                  <li className="flex items-start gap-2 body-sm text-foreground-secondary" key={trait}>
                    <span aria-hidden="true" className="text-primary">·</span>
                    {trait}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="sidereal-heading">
              <h2 className="heading-md" id="sidereal-heading">Sidereal dates</h2>
              <p className="mt-2 body-sm text-foreground-secondary">
                The Sun is traditionally in {profile.sanskritName} from roughly {profile.siderealWindow}. These dates
                differ from Western ones by about three weeks because Vedic astrology measures against the fixed
                stars rather than the equinox.
              </p>
              <Card className="mt-4 p-5">
                <p className="body-sm text-foreground-secondary">
                  Your Sun sign is the least important of the three placements a Vedic astrologer looks at. Find your{" "}
                  <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/calculators/moon-sign" prefetch={false}>
                    Moon sign
                  </Link>{" "}
                  and your{" "}
                  <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/calculators/lagna" prefetch={false}>
                    Lagna
                  </Link>{" "}
                  for a reading that means something.
                </p>
              </Card>
            </section>
          </div>
        </PageContainer>
      </Section>
    </>
  );
}
