import { LockKeyhole, MapPin } from "lucide-react";
import { Section } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { calculators, panchangRows } from "@/data/home";

export function CalculatorAndPanchang() {
  return (
    <Section className="bg-[linear-gradient(180deg,transparent,var(--background-subtle),transparent)]">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1fr_0.9fr]">
        <GlassCard variant="glass" spotlight={true} className="p-6">
          <h2 className="heading-xl">
            Generate Your <span className="text-premium">Free Kundli</span>
          </h2>
          <p className="mt-3 body-sm text-foreground-secondary">Development fixture only until the astrology engine is connected.</p>
          <form className="mt-7 grid gap-4">
            {["Full name", "Birth date", "Birth time", "Birth place"].map((label) => (
              <label className="grid gap-2 caption text-foreground-secondary" key={label}>
                {label}
                <input
                  className="min-h-11 rounded-md border border-white/10 bg-background/60 px-3 body-sm text-foreground outline-none transition focus:border-accent-cyan focus:bg-background/80"
                  placeholder={label === "Birth place" ? "City or place of birth" : label}
                />
              </label>
            ))}
            <Button type="submit" variant="premium">Generate Kundli</Button>
            <p className="inline-flex items-center gap-2 caption text-foreground-muted">
              <LockKeyhole size={14} /> Your data is secure and private.
            </p>
          </form>
        </GlassCard>

        <GlassCard variant="glass" spotlight={true} className="p-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="heading-xl">Free Calculators</h2>
            <a className="text-sm font-semibold text-premium hover:underline" href="/calculators">
              View all
            </a>
          </div>
          <div className="mt-6 divide-y divide-white/10">
            {calculators.map((calculator) => {
              const Icon = calculator.icon;
              return (
                <a className="group flex items-center gap-4 py-4 transition-colors hover:bg-white/5" href="/calculators" key={calculator.title}>
                  <span className="grid size-12 place-items-center rounded-md border border-white/15 bg-background/60 text-premium transition-transform group-hover:scale-105">
                    <Icon size={20} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold transition-colors group-hover:text-premium">{calculator.title}</span>
                    <span className="body-sm text-foreground-muted">{calculator.text}</span>
                  </span>
                </a>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard variant="glass" spotlight={true} className="p-6">
          <p className="inline-flex items-center gap-2 body-sm text-foreground-muted">
            <MapPin size={16} className="text-premium" /> New Delhi
          </p>
          <h2 className="mt-3 heading-xl">Today&apos;s Panchang</h2>
          <div className="mt-6 divide-y divide-white/10">
            {panchangRows.map(([label, value]) => (
              <div className="flex items-center justify-between gap-4 py-4 body-sm" key={label}>
                <span className="text-foreground-muted">{label}</span>
                <span className="text-right font-semibold text-foreground">{value}</span>
              </div>
            ))}
          </div>
          <Button className="mt-6 w-full" href="/panchang" variant="secondary">
            View Full Panchang
          </Button>
        </GlassCard>
      </div>
    </Section>
  );
}
