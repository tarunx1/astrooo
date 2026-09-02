import { ArrowRight, BadgeCheck } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/primitives";
import { storeCategories } from "@/data/home";

export function ShopSection() {
  return (
    <Section className="pt-0" id="shop">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="border border-border bg-surface p-7">
          <SectionHeader
            className="mb-7"
            title="Gemstones & spiritual store"
            text="Product pages separate verified specifications from traditional astrological associations, which keeps trust high and claims responsible."
          />
          <div className="grid gap-3">
            {storeCategories.map((category) => {
              const Icon = category.icon;
              return (
                <a className="flex items-center justify-between gap-4 border border-border bg-background p-4 transition hover:border-premium/70" href={category.href} key={category.title}>
                  <span className="flex items-center gap-3">
                    <Icon className="text-premium" size={20} />
                    <span>
                      <span className="block text-sm font-semibold">{category.title}</span>
                      <span className="block body-sm text-foreground-muted">{category.text}</span>
                    </span>
                  </span>
                  <ArrowRight className="text-foreground-muted" size={17} />
                </a>
              );
            })}
          </div>
        </div>

        <div className="relative overflow-hidden border border-border bg-surface p-7">
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
                <div className="border border-border bg-background/80 p-4 body-sm font-semibold" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
