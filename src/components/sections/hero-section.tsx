import { ArrowRight, ShieldCheck, Star } from "lucide-react";
import { PageContainer } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { ZodiacDial } from "@/components/visuals/zodiac-dial";
import styles from "./hero-section.module.css";
import { quickServices } from "@/data/home";

export function HeroSection() {
  return (
    <section className={`relative overflow-hidden ${styles.hero}`}>
      <PageContainer className="relative py-16">
        <div className={styles.layout}>
          <div className={`relative z-10 ${styles.copy}`}>
            <h1 className={styles.headline}>
              <span className="block">Ancient</span>
              <span className="block">Wisdom.</span>
              <span className="block text-premium">Personalized</span>
              <span className="block text-premium">for You.</span>
            </h1>
            <p className="mt-7 max-w-[520px] body-lg text-foreground-secondary">
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

          <div className={styles.visual}>
            <div className={`zodiac-orbit-frame ${styles.frame}`}>
              <ZodiacDial />
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
