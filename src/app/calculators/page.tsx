import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageContainer, Section } from "@/components/layout/primitives";
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
    <Card
      equalHeight
      className="group border-border/55 bg-surface/60 shadow-none transition duration-200 hover:-translate-y-0.5 hover:border-premium/45 hover:bg-surface/82 hover:shadow-[var(--shadow-md)]"
    >
      <Link
        className="flex h-full flex-col p-4 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-premium"
        href={tool.href}
        prefetch={false}
      >
        <div className="flex items-start justify-between gap-4">
          <span className="grid size-12 place-items-center rounded-xl border border-premium/25 bg-premium/10 text-premium transition group-hover:scale-105 group-hover:bg-premium/15">
            <Icon aria-hidden="true" size={23} strokeWidth={1.8} />
          </span>
          <ArrowRight className="mt-2 text-foreground-muted transition group-hover:translate-x-0.5 group-hover:text-premium" size={17} strokeWidth={1.8} />
        </div>
        <CardBody className="mt-3 gap-1.5">
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
      <Section className="star-field pt-10">
        <PageContainer className="px-0">
          <div className="mb-8 max-w-[42rem]">
            <p className="caption uppercase tracking-[0.18em] text-premium">Tools</p>
            <h1 className="mt-3 heading-xl">Free Astrology Calculators</h1>
            <p className="mt-3 max-w-[38rem] body text-foreground-secondary">
              Deterministic Vedic tools for Moon sign, Nakshatra, Lagna, Sade Sati and numerology.
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {CALCULATOR_HUB_TOOLS.map((tool) => (
              <li key={tool.slug}>
                <CalculatorCard tool={tool} />
              </li>
            ))}
          </ul>

          <h2 className="mt-12 heading-md">More tools</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {others.map((tool) => (
              <li key={tool.slug}>
                <CalculatorCard tool={tool} />
              </li>
            ))}
          </ul>
        </PageContainer>
      </Section>
    </>
  );
}
