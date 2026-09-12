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
  "Find your Lagna (ascendant) and its exact degree from your date, time and place of birth. Calculated with the Lahiri ayanamsa.";

export const metadata: Metadata = {
  title: "Lagna Calculator",
  description: DESCRIPTION,
  alternates: { canonical: `${brand.url}/calculators/lagna` },
  openGraph: { title: "Lagna Calculator | Tarun Astro", description: DESCRIPTION, url: `${brand.url}/calculators/lagna` },
};

const FAQS = [
  {
    question:
      "What if I do not know my birth time?",
    answer:
      "The Lagna cannot be calculated reliably without it. If you mark the time as unknown a default noon time is used, which is useful for the Moon sign but not for the ascendant.",
  },
  {
    question:
      "Why does the Lagna matter?",
    answer:
      "Every house in the chart is counted from the Lagna, so it decides which planet governs which area of life. Two people born the same day with different Lagnas have very different charts.",
  },
  {
    question:
      "Does this match my Kundli?",
    answer:
      "Yes. It uses the same engine, the same ayanamsa and the same calculation version, and reads from the same cached calculation.",
  },
];

const BREADCRUMB = [
  { label: "Home", href: "/" },
  { label: "Calculators", href: "/calculators" },
  { label: "Lagna" },
];

export default function Page() {
  return (
    <>
      <ToolApplicationSchema description={DESCRIPTION} name="Lagna Calculator" path="/calculators/lagna" />
      <ToolBreadcrumbSchema items={BREADCRUMB} />
      <CalculatorFaqSchema faqs={FAQS} />

      <CalculatorShell
        breadcrumb={BREADCRUMB}
        compact
        compactForm="wide"
        faqs={FAQS}
        form={<BirthToolForm slice="lagna" submitLabel="Find My Lagna" />}
        intro="Your Lagna is the sign rising on the eastern horizon at the moment you were born. It anchors the whole chart: every house is counted from it."
        methodology={
          <p>
            The ascendant is the point of the ecliptic rising over your birth place at your birth instant, so it is calculated from the exact time and the coordinates together. It uses the same Lahiri ayanamsa and calculation version as your Kundli, and changes sign roughly every two hours.
          </p>
        }
        related={
          <ReportUpsell
            body="The Lagna is where a reading begins, not where it ends. A Complete Life Report works through every house from your ascendant."
            compact
            cta="See the Complete Life Report"
            heading="Read the whole chart"
            href="/reports/complete-life"
          />
        }
        title="Lagna Calculator"
      />
    </>
  );
}
