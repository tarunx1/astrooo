import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { storeCategories } from "@/data/home";

export function ShopSection() {
  return (
    <Section className="pt-0" id="shop">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <SectionHeader
            className="mb-7"
            title="Gemstones & spiritual store"
            text="Product pages separate verified specifications from traditional astrological associations, which keeps trust high and claims responsible."
          />
          <div className="grid gap-3">
            {storeCategories.map((category) => (
                <Card
                  key={category.title}
                  variant="interactive"
                  className="group"
                >
                  <Link
                    className="flex items-center justify-between gap-4 p-4 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    href={category.href}
                    prefetch={false}
                  >
                    <span className="flex items-center gap-4">
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border">
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
                  </Link>
                </Card>
            ))}
          </div>
        </div>

        <Card variant="premium" className="relative overflow-hidden p-6 sm:p-7">
          <div className="relative max-w-xl">
            <Badge variant="premium">
              <BadgeCheck aria-hidden="true" size={14} />
              Verified commerce
            </Badge>
            <h2 className="mt-5 heading-xl">Built for high-trust commerce</h2>
            <p className="mt-4 body text-foreground-secondary">
              Gemstones can carry carat, origin, treatment, lab certificate, SKU, inventory, care
              instructions, related products, reviews, shipping and authenticity fields in the same
              commerce model as digital reports and consultations.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {["Lab certificate", "Authenticity guarantee", "Inventory variants", "Responsible belief copy"].map((item) => (
                <div className="rounded-lg border border-border bg-surface-raised p-4 body-sm font-semibold text-foreground" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </Section>
  );
}
