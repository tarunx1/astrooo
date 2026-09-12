import { ArrowRight, ShieldCheck, Star } from "lucide-react";
import { PageContainer } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { ZodiacHubCycle } from "@/components/visuals/zodiac-hub-cycle";
import { quickServices } from "@/data/home";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-transparent">
      <PageContainer className="relative py-16">
        <div className="grid min-h-[clamp(520px,calc(100vh-var(--header-height)-18rem),760px)] items-center gap-12 lg:grid-cols-[0.82fr_1fr]">
          <div className="relative z-10 max-w-2xl">
            <h1 className="display-xl">
              <span className="block">Ancient</span>
              <span className="block">Wisdom.</span>
              <span className="block text-premium">Personalized</span>
              <span className="block text-premium">for You.</span>
            </h1>
            <p className="mt-7 max-w-xl body-lg text-foreground-secondary">
              Tarun Astro blends authentic Vedic astrology structure with modern commerce,
              secure accounts and expert review so guidance feels clear, calm and usable.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button href="/kundli" variant="premium">
                Generate Free Kundli <ArrowRight size={17} />
              </Button>
              <Button href="/reports" variant="secondary">
                Explore Reports
              </Button>
            </div>
            <div className="mt-7 grid gap-3 body-sm text-foreground-secondary sm:flex sm:flex-wrap sm:gap-x-6">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck size={16} className="text-premium" /> Verified astrologer network
              </span>
              <span className="inline-flex items-center gap-2">
                <Star size={16} className="text-premium" /> 4.8/5 from consultation reviews
              </span>
            </div>
          </div>

          {/* The wheel turns, so it is centred by a wrapper and rotated by the
              child: one element cannot hold both transforms. The halo, the
              sheen and the signs in the hub are stacked on that same wrapper so
              they share its centre - and so the signs stay upright while the
              wheel turns around them. */}
          <div className="relative min-h-[360px] sm:min-h-[420px] lg:min-h-[520px]">
            <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[108%] -translate-x-1/2 -translate-y-1/2 sm:w-[96%]">
              {/* Every layer is positioned, so they paint in source order: halo
                  behind, then the wheel, then the sign. A static wheel here
                  would be painted under the halo. */}
              <div aria-hidden="true" className="zodiac-wheel-halo absolute -inset-[12%]" />
              {/* The sheen is a child of the wheel, not a sibling: a mask
                  clips an element's whole subtree, so nesting it lets the
                  highlight travel while the artwork stays single. As a sibling
                  it carried its own copy of the mask and turned at its own
                  speed, which drew a second wheel beside the real one. */}
              <div aria-hidden="true" className="zodiac-wheel absolute inset-0 opacity-90">
                <div className="zodiac-wheel-sheen" />
              </div>
              <ZodiacHubCycle />
            </div>
          </div>
        </div>

        <div className="relative z-20 mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {quickServices.map((service) => {
            const Icon = service.icon;
            return (
              <GlassCard
                variant="glass"
                spotlight={true}
                className="flex min-h-24 items-center gap-3 p-4 transition-all duration-300 hover:-translate-y-0.5"
                href={service.href}
                key={service.title}
              >
                <Icon className="shrink-0 text-premium" size={22} />
                <span>
                  <span className="block text-sm font-semibold text-foreground">{service.title}</span>
                  <span className="mt-1 block caption text-foreground-muted">{service.text}</span>
                </span>
              </GlassCard>
            );
          })}
        </div>
      </PageContainer>
    </section>
  );
}
