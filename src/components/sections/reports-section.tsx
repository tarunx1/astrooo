import { ArrowRight } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/primitives";
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
        action={<a className="text-sm font-semibold text-premium" href="/reports">View all reports</a>}
        title="Featured astrology reports"
        text="Digital report commerce uses one product model with clear job states: payment, calculation, interpretation, rendering and secure delivery."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {reports.map((report) => (
          <a className="group overflow-hidden border border-border bg-surface transition hover:border-premium/70" href="/reports" key={report.title}>
            <div className={`h-44 bg-gradient-to-br ${tones[report.tone]} p-4`}>
              <div className="size-24 rounded-full border border-premium/60 bg-background/40 shadow-[0_0_60px_color-mix(in_srgb,var(--premium)_16%,transparent)]" />
            </div>
            <div className="p-5">
              <h3 className="heading-md">{report.title}</h3>
              <p className="mt-2 min-h-11 body-sm text-foreground-secondary">{report.text}</p>
              <p className="mt-4 font-semibold text-premium">{report.price}</p>
            </div>
          </a>
        ))}
      </div>
      <div className="mt-10 grid items-center gap-8 border border-border bg-surface p-7 md:grid-cols-[1fr_auto]">
        <div>
          <h3 className="heading-xl text-premium">Kundli Matching</h3>
          <p className="mt-2 body text-foreground-secondary">Discover compatibility with a focused form flow for two birth profiles.</p>
        </div>
        <a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-premium px-6 text-sm font-semibold text-background" href="/kundli-matching">
          Check Compatibility <ArrowRight size={17} />
        </a>
      </div>
    </Section>
  );
}
