import { ArrowRight, Mail } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { articles } from "@/data/home";
import { SmoothInput } from "@/components/ui/smooth-input";

export function InsightsSection() {
  return (
    <Section id="learn">
      <SectionHeader
        title="Guides that support search without thin pages"
        text="The content architecture is ready for horoscope, transit, calculator and article routes with metadata, breadcrumbs, JSON-LD and internal linking."
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <div className="divide-y divide-border border border-border bg-surface">
          {articles.map((article) => (
            <a className="group flex items-center justify-between gap-6 p-6 transition hover:bg-surface-hover" href="/articles" key={article.title}>
              <span>
                <span className="caption uppercase text-premium">{article.category}</span>
                <span className="mt-2 block heading-md">{article.title}</span>
              </span>
              <ArrowRight className="shrink-0 text-foreground-muted transition group-hover:text-premium" size={18} />
            </a>
          ))}
        </div>
        <div className="border border-border bg-surface p-7">
          <Mail className="text-premium" size={30} />
          <h2 className="mt-5 heading-xl">Stay aligned with cosmic updates</h2>
          <p className="mt-3 body text-foreground-secondary">Weekly insights, panchang alerts and report launches, written with restraint.</p>
          <form className="mt-7 flex flex-col gap-3 sm:flex-row">
            <SmoothInput
              className="form-control flex-1"
              placeholder="Enter your email address"
              type="email"
            />
            <Button type="submit" variant="premium">Subscribe</Button>
          </form>
        </div>
      </div>
    </Section>
  );
}
