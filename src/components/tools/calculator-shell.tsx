import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { PageContainer, Section } from "@/components/layout/primitives";
import { Card } from "@/components/ui/card";
import { brand } from "@/config/brand";
import { serializeJsonLd } from "@/lib/seo/json-ld";

/**
 * Shared layout for the calculator pages.
 *
 * Holds the parts every tool genuinely repeats — breadcrumb, intro, form column,
 * methodology and FAQ — so the pages differ only in their calculation and their
 * copy. It is a layout, not a wrapper for its own sake.
 */
export type CalculatorFaq = { question: string; answer: string };

export function CalculatorShell({
  title,
  intro,
  breadcrumb,
  form,
  result,
  wideForm,
  compact = false,
  compactForm = "narrow",
  methodology,
  faqs,
  related,
}: {
  title: string;
  intro: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  form: React.ReactNode;
  result?: React.ReactNode;
  wideForm?: boolean;
  compact?: boolean;
  compactForm?: "narrow" | "wide";
  methodology: React.ReactNode;
  faqs: CalculatorFaq[];
  related?: React.ReactNode;
}) {
  const isWide = wideForm || !result;

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <nav aria-label="Breadcrumb" className={compact ? "mb-4 opacity-70" : "mb-6"}>
          <ol className="flex flex-wrap items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
            {breadcrumb.map((crumb, index) => (
              <li className="flex items-center gap-2" key={crumb.label}>
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                {crumb.href ? (
                  <Link className="hover:text-foreground" href={crumb.href} prefetch={false}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-foreground-secondary">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {compact ? (
          <div className="mb-3 flex items-center gap-2">
            <span className="font-display text-lg text-premium">✦</span>
            <p className="caption uppercase tracking-[0.18em] text-premium">Daily calculation</p>
          </div>
        ) : null}

        <div className={compact ? "max-w-[38rem]" : undefined}>
          <h1 className="heading-xl">{title}</h1>
          <p className={compact ? "mt-3 max-w-[34rem] body text-foreground-secondary" : "mt-4 max-w-[var(--container-sm)] body-lg text-foreground-secondary"}>{intro}</p>
        </div>

        {isWide ? (
          <div className={compact ? (compactForm === "wide" ? "mt-6 max-w-[960px]" : "mt-6 max-w-[520px]") : "mt-10"}>{form}</div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
            <Card className="p-5 sm:p-6">{form}</Card>
            <div className="min-w-0">{result}</div>
          </div>
        )}

        <div className={compact ? "mt-11 grid gap-12" : "mt-14 grid gap-10"}>
          <section aria-labelledby="methodology-heading" className={compact ? "max-w-2xl" : undefined}>
            <h2 className="heading-md" id="methodology-heading">
              How this is calculated
            </h2>
            <div className={compact ? "mt-3 grid max-w-[38rem] gap-2 body-sm text-foreground-secondary" : "mt-4 grid gap-3 body-md text-foreground-secondary"}>{methodology}</div>
          </section>

          {faqs.length > 0 ? (
            <section aria-labelledby="faq-heading" className={compact ? "mx-auto w-full max-w-2xl" : undefined}>
              {compact ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg text-premium">?</span>
                    <p className="caption uppercase tracking-[0.18em] text-premium">Common questions</p>
                  </div>
                  <h2 className="mt-3 heading-md" id="faq-heading">
                    Common questions
                  </h2>
                  <div className="mt-5 divide-y divide-border/80 rounded-xl border border-border/80 bg-surface/75">
                    {faqs.map((faq) => (
                      <details className="group" key={faq.question}>
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-bold text-foreground transition hover:text-premium [&::-webkit-details-marker]:hidden">
                          <span>{faq.question}</span>
                          <ChevronDown className="shrink-0 text-foreground-muted transition duration-300 group-open:rotate-180 group-open:text-premium" size={17} strokeWidth={1.8} />
                        </summary>
                        <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-open:grid-rows-[1fr]">
                          <div className="overflow-hidden">
                            <p className="px-5 pb-4 body-sm text-foreground-secondary">{faq.answer}</p>
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="heading-md" id="faq-heading">
                    Common questions
                  </h2>
                  <dl className="mt-4 grid gap-3">
                    {faqs.map((faq) => (
                      <Card className="p-5" key={faq.question}>
                        <dt className="heading-sm">{faq.question}</dt>
                        <dd className="mt-2 body-sm text-foreground-secondary">{faq.answer}</dd>
                      </Card>
                    ))}
                  </dl>
                </>
              )}
            </section>
          ) : null}

          {related}
        </div>
      </PageContainer>
    </Section>
  );
}

/** FAQPage structured data. Only emitted when there are real questions. */
export function CalculatorFaqSchema({ faqs }: { faqs: CalculatorFaq[] }) {
  if (faqs.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
  return <script dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} type="application/ld+json" />;
}

export function ToolBreadcrumbSchema({ items }: { items: Array<{ label: string; href?: string }> }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${brand.url}${item.href}` } : {}),
    })),
  };
  return <script dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} type="application/ld+json" />;
}

/**
 * WebApplication structured data for a free tool.
 *
 * Deliberately not Product schema: these calculators are not for sale, and
 * marking them up as products would be misrepresentation.
 */
export function ToolApplicationSchema({ name, description, path }: { name: string; description: string; path: string }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    description,
    url: `${brand.url}${path}`,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  };
  return <script dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} type="application/ld+json" />;
}

/** Conversion link into an existing paid report. No dark patterns. */
export function ReportUpsell({
  heading,
  body,
  href,
  cta,
  compact = false,
}: {
  heading: string;
  body: string;
  href: string;
  cta: string;
  compact?: boolean;
}) {
  return (
    <Card className={compact ? "flex flex-col gap-4 border-premium/35 p-4 sm:flex-row sm:items-center sm:justify-between" : "p-6"} variant="premium">
      <div className={compact ? "max-w-xl" : undefined}>
        <h2 className={compact ? "heading-sm" : "heading-md"}>{heading}</h2>
        <p className="mt-2 body-sm text-foreground-secondary">{body}</p>
      </div>
      <Link
        className={compact ? "inline-flex min-h-10 shrink-0 items-center justify-center rounded-[12px] bg-premium px-4 py-2 text-xs font-semibold text-background transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan" : "mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-premium px-5 py-3 text-sm font-semibold text-background transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"}
        href={href}
        prefetch={false}
      >
        {cta}
      </Link>
    </Card>
  );
}
