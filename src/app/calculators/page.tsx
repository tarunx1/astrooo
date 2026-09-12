import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, ResponsiveGrid, Section, SectionHeader } from "@/components/layout/primitives";
import { Card, CardBody } from "@/components/ui/card";
import { ASTROLOGY_TOOLS, CALCULATOR_HUB_TOOLS, type ToolEntry } from "@/config/calculators";
import { ToolBreadcrumbSchema } from "@/components/tools/calculator-shell";
import { brand } from "@/config/brand";

const DESCRIPTION =
  "Free Vedic astrology calculators: Moon sign, Nakshatra, Lagna, Sade Sati and numerology. Every result is calculated, never generated.";

export const metadata: Metadata = {
  title: "Free Astrology Calculators",
  description: DESCRIPTION,
  alternates: { canonical: `${brand.url}/calculators` },
  openGraph: { title: "Free Astrology Calculators | Tarun Astro", description: DESCRIPTION, url: `${brand.url}/calculators` },
};

const BREADCRUMB = [{ label: "Home", href: "/" }, { label: "Calculators" }];

function CalculatorCard({ tool }: { tool: ToolEntry }) {
  const Icon = tool.icon;

  return (
    <Card equalHeight variant="interactive">
      <Link
        className="flex h-full flex-col p-5 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring"
        href={tool.href}
        prefetch={false}
      >
        <span className="grid size-11 place-items-center rounded-lg border border-border bg-surface-raised text-premium">
          <Icon aria-hidden="true" size={20} />
        </span>
        <CardBody className="mt-4 gap-2">
          <h2 className="heading-sm">{tool.title}</h2>
          <p className="body-sm text-foreground-secondary">{tool.shortDescription}</p>
        </CardBody>
      </Link>
    </Card>
  );
}

export default function CalculatorsPage() {
  const others = ASTROLOGY_TOOLS.filter((tool) => !tool.href.startsWith("/calculators/"));

  return (
    <>
      <ToolBreadcrumbSchema items={BREADCRUMB} />
      <Section className="star-field">
        <PageContainer className="px-0">
          <SectionHeader
            text="Each calculator runs on the same deterministic Vedic engine as our Kundli, with the Lahiri ayanamsa. Nothing on these pages is written by a language model."
            title="Free Astrology Calculators"
          />

          <ResponsiveGrid as="ul" min="18rem">
            {CALCULATOR_HUB_TOOLS.map((tool) => (
              <li key={tool.slug}>
                <CalculatorCard tool={tool} />
              </li>
            ))}
          </ResponsiveGrid>

          <h2 className="mt-14 heading-md">More tools</h2>
          <ResponsiveGrid as="ul" className="mt-4" min="18rem">
            {others.map((tool) => (
              <li key={tool.slug}>
                <CalculatorCard tool={tool} />
              </li>
            ))}
          </ResponsiveGrid>
        </PageContainer>
      </Section>
    </>
  );
}
