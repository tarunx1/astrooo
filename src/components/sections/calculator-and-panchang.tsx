import { LockKeyhole, MapPin } from "lucide-react";
import { Section } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { calculators, panchangRows } from "@/data/home";
import { SmoothInput } from "@/components/ui/smooth-input";

export function CalculatorAndPanchang() {
  const inputClass =
    "min-h-[42px] rounded-[12px] border-border/55 bg-surface/45 px-3.5 py-2 text-sm text-foreground placeholder:text-foreground-muted/80 hover:border-premium/35 focus:border-premium focus:outline-premium/30 focus-visible:border-premium focus-visible:outline-premium/30";

  /*
   * Column counts follow the container, not the viewport.
   *
   * This band sits inside the zodiac gutter, so its container is 62% of the
   * window: at a 1470px screen these three cards had about 260px each, which is
   * what broke every heading and row inside them. A `lg:` breakpoint cannot see
   * that - it only knows the window is wide. A container query measures the
   * space the cards actually get, so three columns arrive when there is room for
   * three, and until then Panchang takes a full-width row of its own rather than
   * leaving a hole in the grid.
   */
  return (
    <Section tone="subtle">
      <div className="@container ml-auto max-w-[1180px]">
        <div className="grid gap-6 @2xl:grid-cols-2 @5xl:grid-cols-[1.05fr_1fr_0.94fr] @5xl:items-start @5xl:gap-7">
        <Card className="border-border/55 bg-surface/62 p-5 shadow-none sm:p-6" variant="glass" spotlight={true}>
          <p className="caption uppercase tracking-[0.18em] text-premium">Private birth chart</p>
          <h2 className="mt-3 heading-lg">
            Generate Your <span className="text-premium">Free Kundli</span>
          </h2>
          <p className="mt-2 max-w-[20rem] body-sm text-foreground-secondary">
            Start with verified birth details and keep the result private.
          </p>
          <form className="mt-5 grid gap-4">
            {["Full name", "Birth date", "Birth time", "Birth place"].map((label) => (
              <label className="grid gap-2 caption text-foreground-secondary" key={label}>
                {label}
                <SmoothInput
                  className={inputClass}
                  placeholder={label === "Birth place" ? "City or place of birth" : label}
                />
              </label>
            ))}
            <Button className="min-h-11 w-full rounded-[12px] text-sm shadow-[0_14px_34px_rgb(214_181_109/0.2)] hover:-translate-y-0.5 hover:opacity-100 active:translate-y-0" type="submit" variant="premium">
              Generate Kundli
            </Button>
            <p className="inline-flex items-center gap-2 caption text-foreground-muted">
              <LockKeyhole size={14} /> Your data is secure and private.
            </p>
          </form>
        </Card>

        <Card className="border-border/45 bg-surface/55 p-5 shadow-none sm:p-6" variant="glass" spotlight={true}>
          {/* Wraps rather than squeezing: when the heading and the link cannot
              share a line, the link drops to its own and stays right-aligned,
              instead of crushing "Free Calculators" into two lines beside it. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="heading-lg">Free Calculators</h2>
            <Button className="ml-auto shrink-0 whitespace-nowrap text-sm no-underline hover:no-underline" href="/calculators" variant="text">
              View all
            </Button>
          </div>
          <div className="mt-5 grid gap-3">
            {calculators.map((calculator) => {
              const Icon = calculator.icon;
              return (
                <a className="group flex items-center gap-4 rounded-[12px] p-2.5 transition-colors hover:bg-surface/65" href="/calculators" key={calculator.title}>
                  <span className="grid size-12 shrink-0 place-items-center rounded-[12px] border border-border/50 bg-background/45 text-premium transition group-hover:border-premium/40 group-hover:bg-premium/10">
                    <Icon size={22} strokeWidth={1.8} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-foreground transition-colors group-hover:text-premium">{calculator.title}</span>
                    <span className="body-sm text-foreground-secondary">{calculator.text}</span>
                  </span>
                </a>
              );
            })}
          </div>
        </Card>

        <Card className="border-border/55 bg-surface/62 p-5 shadow-none @2xl:col-span-2 @5xl:col-span-1 sm:p-6" variant="glass" spotlight={true}>
          <p className="inline-flex items-center gap-2 body-sm text-foreground-muted">
            <MapPin size={16} className="text-premium" /> New Delhi
          </p>
          <h2 className="mt-3 heading-lg">Today&apos;s Panchang</h2>
          <div className="mt-5 divide-y divide-white/10">
            {/* A value is never broken mid-phrase. If the pair does not fit on
                one line the whole value moves to the next, still right-aligned -
                rather than "10:42 AM - 12:18" sitting above a stranded "PM". */}
            {panchangRows.map(([label, value]) => (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-3 body-sm" key={label}>
                <span className="text-foreground-muted">{label}</span>
                <span className="ml-auto whitespace-nowrap text-right font-semibold text-foreground">{value}</span>
              </div>
            ))}
          </div>
          <Button className="mt-5 min-h-11 w-full rounded-[12px] border-premium/45 bg-premium/10 text-premium hover:bg-premium hover:text-background" href="/panchang" variant="secondary">
            View Full Panchang
          </Button>
          </Card>
        </div>
      </div>
    </Section>
  );
}
