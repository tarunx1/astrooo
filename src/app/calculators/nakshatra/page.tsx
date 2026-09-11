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
  "Find your birth Nakshatra and its pada from your date, time and place of birth, with the Moon's exact sidereal longitude.";

export const metadata: Metadata = {
  title: "Nakshatra Calculator",
  description: DESCRIPTION,
  alternates: { canonical: `${brand.url}/calculators/nakshatra` },
  openGraph: { title: "Nakshatra Calculator | Tarun Astro", description: DESCRIPTION, url: `${brand.url}/calculators/nakshatra` },
};

const FAQS = [
  {
    question:
      "What is a pada?",
    answer:
      "Each Nakshatra is divided into four quarters called padas. The pada narrows the reading and is used in compatibility and in choosing the first syllable of a traditional name.",
  },
  {
    question:
      "Why does my Nakshatra matter more than my sign?",
    answer:
      "Nakshatras are the older layer of Vedic astrology. The Vimshottari dasha sequence that times events is derived from the birth Nakshatra, not from the sign.",
  },
  {
    question:
      "How precise must my birth time be?",
    answer:
      "The Moon crosses one Nakshatra in about a day and one pada in roughly six hours, so an accurate time matters more here than for the sign alone.",
  },
];

const BREADCRUMB = [
  { label: "Home", href: "/" },
  { label: "Calculators", href: "/calculators" },
  { label: "Nakshatra" },
];

export default function Page() {
  return (
    <>
      <ToolApplicationSchema description={DESCRIPTION} name="Nakshatra Calculator" path="/calculators/nakshatra" />
      <ToolBreadcrumbSchema items={BREADCRUMB} />
      <CalculatorFaqSchema faqs={FAQS} />

      <CalculatorShell
        breadcrumb={BREADCRUMB}
        faqs={FAQS}
        form={<BirthToolForm slice="nakshatra" submitLabel="Find My Nakshatra" />}
        intro="The Nakshatra is the lunar mansion the Moon occupied at your birth. There are 27, each divided into four padas."
        methodology={
          <>
            <p>
              The engine returns the Moon&apos;s sidereal longitude. The zodiac is divided into 27 Nakshatras of 13 degrees 20 minutes each, and into 108 padas, so both follow arithmetically from that longitude.
            </p>
            <p>
              Only the Nakshatra, its pada and the Moon&apos;s position are calculated values. Any description of a Nakshatra&apos;s traditional character is static educational content, not a calculation about you.
            </p>
            <p>
              Calculated with the Lahiri ayanamsa on a sidereal zodiac.
            </p>
          </>
        }
        related={
          <ReportUpsell
            body="Your Nakshatra sets the dasha sequence. A Complete Life Report reads that timing against the rest of your chart."
            cta="See the Complete Life Report"
            heading="Read the whole chart"
            href="/reports/complete-life"
          />
        }
        title="Nakshatra Calculator"
      />
    </>
  );
}
