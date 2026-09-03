import Link from "next/link";
import { PageContainer, Section } from "@/components/layout/primitives";
import { Card } from "@/components/ui/card";
import { brand } from "@/config/brand";

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
  methodology,
  faqs,
  related,
}: {
  title: string;
  intro: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  form: React.ReactNode;
  result?: React.ReactNode;
  methodology: React.ReactNode;
  faqs: CalculatorFaq[];
  related?: React.ReactNode;
}) {
  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-2 caption text-foreground-muted">
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

        <h1 className="heading-xl">{title}</h1>
        <p className="mt-4 max-w-[var(--container-sm)] body-lg text-foreground-secondary">{intro}</p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
          <Card className="p-5 sm:p-6">{form}</Card>
          <div className="min-w-0">{result}</div>
        </div>

        <div className="mt-14 grid gap-10">
          <section aria-labelledby="methodology-heading">
            <h2 className="heading-md" id="methodology-heading">
              How this is calculated
            </h2>
            <div className="mt-4 grid gap-3 body-md text-foreground-secondary">{methodology}</div>
          </section>

          {faqs.length > 0 ? (
            <section aria-labelledby="faq-heading">
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

  return <script dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} type="application/ld+json" />;
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

  return <script dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} type="application/ld+json" />;
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

  return <script dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} type="application/ld+json" />;
}

/** Conversion link into an existing paid report. No dark patterns. */
export function ReportUpsell({
  heading,
  body,
  href,
  cta,
}: {
  heading: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <Card className="p-6" variant="premium">
      <h2 className="heading-md">{heading}</h2>
      <p className="mt-2 body-sm text-foreground-secondary">{body}</p>
      <Link
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-premium px-5 py-3 text-sm font-semibold text-background transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
        href={href}
        prefetch={false}
      >
        {cta}
      </Link>
    </Card>
  );
}
