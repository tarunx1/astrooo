import type { Metadata } from "next";
import { ShieldCheck, Sparkles } from "lucide-react";
import { BirthDetailsForm } from "@/components/kundli/birth-details-form";
import { PageContainer, Section } from "@/components/layout/primitives";
import { createBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import { getCspNonce } from "@/lib/security/nonce";

export const metadata: Metadata = {
  title: "Free Janam Kundli",
  description: "Generate a free Janam Kundli from normalized birth details, resolved location data and a replaceable astrology provider foundation.",
  alternates: { canonical: "/kundli" },
  openGraph: {
    title: "Free Janam Kundli | Ravish Astro",
    description: "Create a structured Kundli foundation for future reports, matching, consultations and saved birth profiles.",
    url: "/kundli",
  },
};

const discoveries = ["Lagna / Ascendant", "Moon Sign", "Sun Sign", "Nakshatra", "Planetary Positions", "Houses", "Vimshottari Dasha", "Manglik status", "Important chart insights"];
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
  const nonce = await getCspNonce();
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
      <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Section className="star-field border-b border-border">
        <PageContainer className="grid gap-10 px-0 lg:grid-cols-[0.82fr_1fr] lg:items-start">
          <div className="max-w-2xl">
            <p className="caption uppercase text-premium">Free Kundli Foundation</p>
            <h1 className="mt-4 display-lg">Generate Your Free Janam Kundli</h1>
            <p className="mt-6 body-lg text-foreground-secondary">
              Enter precise birth details once to create a structured Kundli result that can later support reports, matching, consultations and saved profiles.
            </p>
            <div className="mt-8 rounded-lg border border-border bg-surface/90 p-5">
              <div className="flex gap-3">
                <ShieldCheck className="mt-1 shrink-0 text-premium" size={20} />
                <p className="body-sm text-foreground-secondary">
                  Birth details are treated as private customer data. They are not placed in public URLs, and result pages are marked noindex.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface/95 p-6 shadow-[var(--shadow-lg)]">
            <h2 className="heading-lg">Birth Details</h2>
            <p className="mt-2 body-sm text-foreground-secondary">Select a resolved place suggestion so calculation data includes latitude, longitude and timezone.</p>
            <div className="mt-6">
              <BirthDetailsForm />
            </div>
          </div>
        </PageContainer>
      </Section>

      <Section>
        <div className="grid gap-8 lg:grid-cols-[0.7fr_1fr]">
          <div>
            <Sparkles className="text-premium" size={28} />
            <h2 className="mt-4 heading-xl">What you&apos;ll discover</h2>
            <p className="mt-3 body text-foreground-secondary">The first version focuses on a normalized result structure, not long-form interpretation.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {discoveries.map((item) => (
              <div className="rounded-md border border-border bg-surface p-4 body-sm font-semibold" key={item}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section className="bg-background-subtle">
        <div className="max-w-3xl">
          <h2 className="heading-xl">Free Kundli FAQ</h2>
          <div className="mt-8 divide-y divide-border rounded-lg border border-border bg-surface">
            {faqs.map((faq) => (
              <details className="group p-5" key={faq.question}>
                <summary className="cursor-pointer list-none font-semibold text-foreground [&::-webkit-details-marker]:hidden">{faq.question}</summary>
                <p className="mt-3 body-sm text-foreground-secondary">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
