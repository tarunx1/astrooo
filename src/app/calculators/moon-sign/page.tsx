import type { Metadata } from "next";
import {
  CalculatorFaqSchema,
  CalculatorShell,
  ReportUpsell,
  ToolApplicationSchema,
  ToolBreadcrumbSchema,
} from "@/components/tools/calculator-shell";
import { BirthToolForm } from "@/components/tools/birth-tool-form";
import { brand } from "@/config/brand";

const DESCRIPTION =
  "Find your Vedic Moon sign (Chandra Rashi) and birth Nakshatra from your date, time and place of birth. Calculated with the Lahiri ayanamsa.";

export const metadata: Metadata = {
  title: "Moon Sign Calculator",
  description: DESCRIPTION,
  alternates: { canonical: `${brand.url}/calculators/moon-sign` },
  openGraph: { title: "Moon Sign Calculator | Tarun Astro", description: DESCRIPTION, url: `${brand.url}/calculators/moon-sign` },
};

const FAQS = [
  {
    question:
      "Why is my Vedic Moon sign different from my Western sign?",
    answer:
      "Vedic astrology uses the sidereal zodiac, measured against the fixed stars, while Western astrology uses the tropical zodiac tied to the equinox. The two currently differ by roughly 24 degrees, so signs often shift by one.",
  },
  {
    question:
      "How exact does my birth time need to be?",
    answer:
      "The Moon moves about one degree every two hours and changes sign roughly every two and a quarter days. A time accurate to within an hour is usually enough for the sign, though the Nakshatra pada is more sensitive.",
  },
  {
    question:
      "What is the Moon sign used for?",
    answer:
      "It is the basis of the Vimshottari dasha system, of Nakshatra-based compatibility, and of Sade Sati. Most traditional predictive work is measured from the Moon rather than the Sun.",
  },
];

const BREADCRUMB = [
  { label: "Home", href: "/" },
  { label: "Calculators", href: "/calculators" },
  { label: "Moon Sign" },
];

export default function Page() {
  return (
    <>
      <ToolApplicationSchema description={DESCRIPTION} name="Moon Sign Calculator" path="/calculators/moon-sign" />
      <ToolBreadcrumbSchema items={BREADCRUMB} />
      <CalculatorFaqSchema faqs={FAQS} />

      <CalculatorShell
        breadcrumb={BREADCRUMB}
        compact
        compactForm="wide"
        faqs={FAQS}
        form={<BirthToolForm slice="moonSign" submitLabel="Find My Moon Sign" />}
        intro="Your Moon sign is the sign the Moon occupied at your birth. In Vedic astrology it carries far more weight than the Sun sign most people know."
        methodology={
          <p>
            The Vedic engine calculates the Moon&apos;s sidereal longitude for the normalized birth details. The Moon sign and Nakshatra follow directly from that value using the Lahiri ayanamsa.
          </p>
        }
        related={
          <ReportUpsell
            body="The Moon sign is one placement. A Complete Life Report reads the Lagna, all nine planets, the houses and the running dasha together."
            compact
            cta="See the Complete Life Report"
            heading="Read the whole chart"
            href="/reports/complete-life"
          />
        }
        title="Moon Sign Calculator"
      />
    </>
  );
}
