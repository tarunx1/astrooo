import type { Metadata } from "next";
import {
  CalculatorFaqSchema,
  CalculatorShell,
  ReportUpsell,
  ToolApplicationSchema,
  ToolBreadcrumbSchema,
} from "@/components/tools/calculator-shell";
import { SadeSatiForm } from "@/components/tools/birth-tool-form";
import { brand } from "@/config/brand";

const DESCRIPTION =
  "Check whether you are currently in Sade Sati. Compares Saturn's current sidereal position against your natal Moon sign.";

export const metadata: Metadata = {
  title: "Sade Sati Calculator",
  description: DESCRIPTION,
  alternates: { canonical: `${brand.url}/calculators/sade-sati` },
  openGraph: { title: "Sade Sati Calculator | Tarun Astro", description: DESCRIPTION, url: `${brand.url}/calculators/sade-sati` },
};

const FAQS = [
  {
    question:
      "Is Sade Sati a bad period?",
    answer:
      "Tradition describes it as demanding rather than disastrous, and associates it with responsibility, slower progress and reassessment. We do not present it as a prediction of misfortune, and no remedy is required to read this page.",
  },
  {
    question:
      "How is the phase decided?",
    answer:
      "By which sign Saturn currently occupies relative to your natal Moon. The twelfth is the first phase, your Moon sign itself is the peak, and the second sign is the closing phase.",
  },
  {
    question:
      "Why does this need my birth details?",
    answer:
      "Sade Sati is measured from your natal Moon sign, which can only be calculated from your date, time and place of birth.",
  },
];

const BREADCRUMB = [
  { label: "Home", href: "/" },
  { label: "Calculators", href: "/calculators" },
  { label: "Sade Sati" },
];

export default function Page() {
  return (
    <>
      <ToolApplicationSchema description={DESCRIPTION} name="Sade Sati Calculator" path="/calculators/sade-sati" />
      <ToolBreadcrumbSchema items={BREADCRUMB} />
      <CalculatorFaqSchema faqs={FAQS} />

      <CalculatorShell
        breadcrumb={BREADCRUMB}
        faqs={FAQS}
        form={<SadeSatiForm />}
        intro="Sade Sati is the roughly seven and a half year period when Saturn transits the sign before your Moon, your Moon sign itself, and the sign after it."
        methodology={
          <>
            <p>
              Two calculated values are combined. Your natal Moon sign comes from your birth chart, and Saturn&apos;s current sidereal sign comes from a transit calculation for today. Both are produced by our Vedic engine.
            </p>
            <p>
              The classification itself is a documented rule rather than an engine output: Saturn in the twelfth, first or second sign from your Moon marks the three phases of Sade Sati; the fourth is Ardha Kantaka and the eighth is Ashtama Shani. Signs are counted inclusively. The exact rule is printed with your result.
            </p>
            <p>
              Saturn spends about two and a half years in a sign, so this result changes slowly. Saturn&apos;s position is calculated once and shared across visitors rather than requested per person.
            </p>
          </>
        }
        related={
          <ReportUpsell
            body="A Year Forecast reads your running dasha and the current transits together, rather than one transit in isolation."
            cta="See the Year Forecast"
            heading="Understand the timing"
            href="/reports/year-forecast"
          />
        }
        title="Sade Sati Calculator"
      />
    </>
  );
}
