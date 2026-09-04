import Image from "next/image";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/primitives";
import { GlassCard } from "@/components/ui/glass-card";
import { storeCategories } from "@/data/home";

export function ShopSection() {
  return (
    <Section className="pt-0" id="shop">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <GlassCard variant="glass" spotlight={true} className="p-7">
          <SectionHeader
            className="mb-7"
            title="Gemstones & spiritual store"
            text="Product pages separate verified specifications from traditional astrological associations, which keeps trust high and claims responsible."
          />
          <div className="grid gap-3">
            {storeCategories.map((category) => (
                <GlassCard
                  href={category.href}
                  key={category.title}
                  variant="glass-subtle"
                  spotlight={true}
                  className="flex items-center justify-between gap-4 p-4 transition-all duration-300 hover:scale-[1.01]"
                >
                  <span className="flex items-center gap-4">
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-white/10">
                      <Image
                        src={category.image}
                        alt={category.title}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{category.title}</span>
                      <span className="block body-sm text-foreground-muted">{category.text}</span>
                    </span>
                  </span>
                  <ArrowRight className="text-foreground-muted group-hover:text-premium transition-colors" size={17} />
                </GlassCard>
            ))}
          </div>
        </GlassCard>

        <GlassCard variant="glass-premium" spotlight={true} className="relative overflow-hidden p-7">
          <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--premium)_20%,transparent),transparent_60%)]" />
          <div className="relative max-w-xl">
            <BadgeCheck className="text-premium" size={28} />
            <h2 className="mt-5 heading-xl">Built for high-trust commerce</h2>
            <p className="mt-4 body text-foreground-secondary">
              Gemstones can carry carat, origin, treatment, lab certificate, SKU, inventory, care
              instructions, related products, reviews, shipping and authenticity fields in the same
              commerce model as digital reports and consultations.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {["Lab certificate", "Authenticity guarantee", "Inventory variants", "Responsible belief copy"].map((item) => (
                <div className="rounded-lg border border-white/10 bg-background/60 p-4 body-sm font-semibold text-foreground backdrop-blur-sm" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>
    </Section>
  );
}
