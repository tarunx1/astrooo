import { ShieldCheck } from "lucide-react";
import { PageContainer } from "@/components/layout/primitives";
import { trustMetrics } from "@/data/home";

export function TrustSection() {
  return (
    <section className="border-y border-border py-12">
      <PageContainer className="grid gap-7 md:grid-cols-[0.8fr_1fr] md:items-center">
        <div>
          <ShieldCheck className="text-premium" size={30} />
          <h2 className="mt-4 heading-xl">Trust is a product feature</h2>
          <p className="mt-3 body text-foreground-secondary">
            Accounts, order history, report delivery, saved profiles and payment states are treated
            as first-class platform surfaces from day one.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {trustMetrics.map((metric) => (
            <div className="border-l border-border pl-5" key={metric.label}>
              <p className="font-display text-4xl text-premium">{metric.value}</p>
              <p className="mt-1 body-sm text-foreground-secondary">{metric.label}</p>
            </div>
          ))}
        </div>
      </PageContainer>
    </section>
  );
}
