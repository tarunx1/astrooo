import type { Metadata } from "next";
import { CalculatorFaqSchema, CalculatorShell, ReportUpsell, ToolApplicationSchema, ToolBreadcrumbSchema } from "@/components/tools/calculator-shell";
import { MatchingForm } from "@/components/tools/matching-form";
import { brand } from "@/config/brand";

const DESCRIPTION =
  "Free Kundli matching using traditional Ashtakoota (Guna Milan). Enter two sets of birth details for a Vedic compatibility assessment with a koota-by-koota breakdown.";

export const metadata: Metadata = {
  title: "Kundli Matching | Free Ashtakoota Guna Milan",
  description: DESCRIPTION,
  alternates: { canonical: `${brand.url}/kundli-matching` },
  openGraph: {
    title: "Kundli Matching | Tarun Astro",
    description: DESCRIPTION,
    url: `${brand.url}/kundli-matching`,
    type: "website",
  },
};

const FAQS = [
  {
    question: "What score is considered a good match?",
    answer:
      "Traditionally a total of 18 or more out of 36 Gunas is treated as acceptable, and 24 or more as strong. A score is one input among many: an astrologer reads the two charts together rather than deciding on the number alone.",
  },
  {
    question: "Why do some kootas show no score?",
    answer:
      "Our calculation engine reports a numeric score for some kootas and only a favourable or unfavourable classification for others. We show exactly what it calculated. We do not estimate the missing numbers or adjust them so the eight add up to 36.",
  },
  {
    question: "Do I need an exact birth time?",
    answer:
      "An exact time gives the most reliable result because the Moon changes Nakshatra roughly every day, and several kootas depend on it. If you are unsure, mark the time as approximate so the result is read with that in mind.",
  },
  {
    question: "Is my birth information stored or shared?",
    answer:
      "Matching works without an account and your birth details are never placed in the page address. Nothing about the two people is exposed in a shareable link.",
  },
];

const BREADCRUMB = [{ label: "Home", href: "/" }, { label: "Kundli Matching" }];

export default function KundliMatchingPage() {
  return (
    <>
      <ToolApplicationSchema description={DESCRIPTION} name="Kundli Matching" path="/kundli-matching" />
      <ToolBreadcrumbSchema items={BREADCRUMB} />
      <CalculatorFaqSchema faqs={FAQS} />

      <CalculatorShell
        breadcrumb={BREADCRUMB}
        faqs={FAQS}
        form={<MatchingForm />}
        intro="Enter the birth details of both people for a traditional Ashtakoota compatibility assessment. Every value is calculated from the two charts — nothing here is generated text."
        methodology={
          <>
            <p>
              Both sets of birth details are normalised through the same canonical schema and place resolution used by
              our Kundli, then sent to our Vedic calculation engine. The engine returns an overall Guna score and a
              classification for each traditional koota.
            </p>
            <p>
              Where the engine supplies a numeric score for a koota we show it. Where it supplies only a favourable or
              unfavourable reading, we say so plainly rather than inventing a number. We never back-fill sub-scores to
              make the eight kootas total 36.
            </p>
            <p>
              Calculations use the Lahiri ayanamsa on a sidereal zodiac, the same configuration as every other
              calculation on this site.
            </p>
          </>
        }
        related={
          <ReportUpsell
            body="A written Love & Marriage report reads the seventh house, Venus and the running dasha periods across both charts, rather than reducing the question to a single number."
            cta="See the Love & Marriage Report"
            heading="Want this read properly?"
            href="/reports/love-marriage"
          />
        }
        title="Kundli Matching"
      />
    </>
  );
}
