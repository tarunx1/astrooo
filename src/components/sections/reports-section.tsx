import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, GlassCard } from "@/components/ui/card";
import { PriceDisplay } from "@/components/ui/price-display";
import { ResponsiveGrid, Section, SectionHeader } from "@/components/layout/primitives";
import { reports } from "@/data/home";

const tones = {
  chart: "from-primary/30 via-surface-raised to-background",
  mountain: "from-accent-cyan/20 via-surface-raised to-background",
  heart: "from-premium/25 via-surface-raised to-background",
  tree: "from-success/20 via-surface-raised to-background",
  planet: "from-primary-hover/25 via-surface-raised to-background",
};

export function ReportsSection() {
  return (
    <Section id="reports">
      <SectionHeader
        action={<Button href="/reports" variant="text">View all reports</Button>}
        title="Featured astrology reports"
        text="Digital report commerce uses one product model with clear job states: payment, calculation, interpretation, rendering and secure delivery."
      />
      <ResponsiveGrid min="13.5rem">
        {reports.map((report) => (
          <Card
            className="group overflow-hidden"
            equalHeight
            key={report.title}
            variant="interactive"
          >
            <Link
              className="flex h-full flex-col focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
              href="/reports"
              prefetch={false}
            >
              <div className={`relative h-40 overflow-hidden bg-gradient-to-br ${tones[report.tone]} p-4 flex items-center justify-center`}>
                <div className="relative size-24 overflow-hidden rounded-full border border-premium/60 shadow-[var(--shadow-md)]">
                  <Image
                    src={report.image}
                    alt={report.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="96px"
                  />
                </div>
              </div>
              <CardBody className="gap-3 p-5">
                <h3 className="heading-md">{report.title}</h3>
                <p className="body-sm text-foreground-secondary">{report.text}</p>
                <CardFooter className="pt-2">
                  <PriceDisplay amount={report.price} meta="Digital report" size="sm" />
                </CardFooter>
              </CardBody>
            </Link>
          </Card>
        ))}
      </ResponsiveGrid>
      <GlassCard
        variant="glass-premium"
        spotlight={true}
        className="mt-10 grid items-center gap-8 p-7 md:grid-cols-[1fr_auto]"
      >
        <div>
          <h3 className="heading-xl text-premium">Kundli Matching</h3>
          <p className="mt-2 body text-foreground-secondary">Discover compatibility with a focused form flow for two birth profiles.</p>
        </div>
        <Button href="/kundli-matching" variant="premium">
          Check Compatibility <ArrowRight size={17} />
        </Button>
      </GlassCard>
    </Section>
  );
}
