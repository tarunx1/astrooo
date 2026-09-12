import type { Metadata } from "next";
import { ChevronDown, ShieldCheck, Sparkles } from "lucide-react";
import { BirthDetailsForm } from "@/components/kundli/birth-details-form";
import { PageContainer, Section } from "@/components/layout/primitives";
import { createBreadcrumbJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";

export const metadata: Metadata = {
  title: "Free Janam Kundli",
  description: "Generate a free Janam Kundli from normalized birth details, resolved location data and a replaceable astrology provider foundation.",
  alternates: { canonical: "/kundli" },
  openGraph: {
    title: "Free Janam Kundli | Tarun Astro",
    description: "Create a structured Kundli foundation for future reports, matching, consultations and saved birth profiles.",
    url: "/kundli",
  },
};

const featuredDiscoveries = [
  {
    title: "Lagna / Ascendant",
    glyph: "↗",
    text: "The rising sign that anchors house placement and the chart’s first reading.",
  },
  {
    title: "Moon Sign",
    glyph: "☽",
    text: "The emotional and mental signature used across dasha and daily guidance.",
  },
];
const supportingDiscoveries = [
  { title: "Sun Sign", glyph: "☉" },
  { title: "Nakshatra", glyph: "✦" },
  { title: "Planetary Positions", glyph: "☿" },
  { title: "Houses", glyph: "◇" },
  { title: "Vimshottari Dasha", glyph: "⌁" },
  { title: "Manglik status", glyph: "♂" },
  { title: "Chart insights", glyph: "✧" },
];
const faqs = [
  {
    question: "Is the free Janam Kundli locked behind login?",
    answer: "No. You can generate the free Kundli without creating an account. Account support can later save birth profiles securely.",
  },
  {
    question: "Why does birth place need more than a city name?",
    answer: "Accurate chart calculation needs normalized city, region, country, latitude, longitude and timezone. A plain city string is not enough internally.",
  },
  {
    question: "Are these calculations final production astrology?",
    answer: "This phase uses a clearly marked deterministic development provider until a licensed deterministic astrology engine is integrated.",
  },
];

export default async function KundliPage() {
  const jsonLd = [
    createBreadcrumbJsonLd([
      { name: "Home", url: "/" },
      { name: "Free Janam Kundli", url: "/kundli" },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <Section className="star-field border-b border-border">
        <PageContainer className="grid gap-10 px-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,400px)] lg:items-start">
          <div className="max-w-[38rem]">
            <p className="caption uppercase text-premium">Free Kundli Foundation</p>
            <h1 className="mt-4 display-lg">Generate Your Free Janam Kundli</h1>
            <p className="mt-5 max-w-[34rem] body-lg text-foreground-secondary">
              Enter precise birth details once to create a structured Kundli result that can later support reports, matching, consultations and saved profiles.
            </p>
            <div className="mt-7 max-w-[30rem] rounded-md border border-premium/20 bg-surface/55 px-4 py-3 backdrop-blur-md">
              <div className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 shrink-0 text-premium" size={16} strokeWidth={1.8} />
                <p className="text-sm leading-6 text-foreground-secondary">
                  Birth details are treated as private customer data. They are not placed in public URLs, and result pages are marked noindex.
                </p>
              </div>
            </div>
          </div>
          <div className="w-full max-w-[400px] justify-self-end rounded-xl border border-border/70 bg-surface/88 p-4 shadow-[var(--shadow-lg)] backdrop-blur-xl">
            <h2 className="text-[2rem] font-bold leading-tight tracking-tight text-foreground">Birth Details</h2>
            <p className="mt-1.5 max-w-[20rem] body-sm text-foreground-secondary">Resolve the birth place so coordinates and timezone are accurate.</p>
            <div className="mt-4">
              <BirthDetailsForm compact submitLabel="Generate Janam Kundli" />
            </div>
          </div>
        </PageContainer>
      </Section>

      <Section className="pb-12">
        <div className="grid gap-8 lg:grid-cols-[0.68fr_1fr] lg:items-start">
          <div className="max-w-md">
            <Sparkles className="text-premium" size={24} strokeWidth={1.8} />
            <h2 className="mt-4 heading-xl">What you&apos;ll discover</h2>
            <p className="mt-3 body text-foreground-secondary">The first version focuses on a normalized result structure, not long-form interpretation.</p>
          </div>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {featuredDiscoveries.map((item) => (
                <article className="rounded-xl border border-premium/25 bg-surface/75 p-5 shadow-[var(--shadow-sm)]" key={item.title}>
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="heading-sm">{item.title}</h3>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full border border-premium/25 bg-premium/10 font-display text-xl text-premium">
                      {item.glyph}
                    </span>
                  </div>
                  <p className="mt-4 body-sm text-foreground-secondary">{item.text}</p>
                </article>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {supportingDiscoveries.map((item) => (
                <div className="flex min-h-12 items-center gap-3 rounded-[10px] border border-border/75 bg-surface/55 px-3.5 py-2.5 text-sm font-semibold" key={item.title}>
                  <span className="font-display text-base text-premium">{item.glyph}</span>
                  <span>{item.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section className="border-t border-border/70 bg-background-subtle py-12">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg text-premium">✦</span>
            <p className="caption uppercase tracking-[0.18em] text-premium">Questions</p>
          </div>
          <h2 className="mt-3 heading-xl">Free Kundli FAQ</h2>
          <div className="mt-5 divide-y divide-border/80 rounded-xl border border-border/80 bg-surface/80">
            {faqs.map((faq) => (
              <details className="group" key={faq.question}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-foreground transition hover:text-premium [&::-webkit-details-marker]:hidden">
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
        </div>
      </Section>
    </>
  );
}
