import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/primitives";
import { GlassCard } from "@/components/ui/glass-card";
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
        action={<Link className="text-sm font-semibold text-premium hover:underline" href="/reports" prefetch={false}>View all reports</Link>}
        title="Featured astrology reports"
        text="Digital report commerce uses one product model with clear job states: payment, calculation, interpretation, rendering and secure delivery."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {reports.map((report) => (
          <GlassCard
            variant="glass"
            spotlight={true}
            className="transition-all duration-300 hover:-translate-y-1"
            href="/reports"
            key={report.title}
            prefetch={false}
          >
            <div className={`relative h-44 overflow-hidden bg-gradient-to-br ${tones[report.tone]} p-4 flex items-center justify-center`}>
              <div className="relative size-28 overflow-hidden rounded-full border border-premium/60 shadow-[0_0_40px_color-mix(in_srgb,var(--premium)_30%,transparent)]">
                <Image
                  src={report.image}
                  alt={report.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  sizes="120px"
                />
              </div>
            </div>
            <div className="p-5">
              <h3 className="heading-md">{report.title}</h3>
              <p className="mt-2 min-h-11 body-sm text-foreground-secondary">{report.text}</p>
              <p className="mt-4 font-semibold text-premium">{report.price}</p>
            </div>
          </GlassCard>
        ))}
      </div>
      <GlassCard
        variant="glass-premium"
        spotlight={true}
        className="mt-10 grid items-center gap-8 p-7 md:grid-cols-[1fr_auto]"
      >
        <div>
          <h3 className="heading-xl text-premium">Kundli Matching</h3>
          <p className="mt-2 body text-foreground-secondary">Discover compatibility with a focused form flow for two birth profiles.</p>
        </div>
        <a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-premium px-6 text-sm font-semibold text-background transition-transform hover:scale-105" href="/kundli-matching">
          Check Compatibility <ArrowRight size={17} />
        </a>
      </GlassCard>
    </Section>
  );
}
