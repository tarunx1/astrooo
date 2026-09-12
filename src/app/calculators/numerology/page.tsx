import type { Metadata } from "next";
import {
  CalculatorFaqSchema,
  CalculatorShell,
  ReportUpsell,
  ToolApplicationSchema,
  ToolBreadcrumbSchema,
} from "@/components/tools/calculator-shell";
import { NumerologyForm } from "@/components/tools/numerology-form";
import { brand } from "@/config/brand";

const DESCRIPTION =
  "Free Chaldean numerology calculator. Find your Life Path and Birth Number, with the full arithmetic shown so you can check it yourself.";

export const metadata: Metadata = {
  title: "Numerology Calculator",
  description: DESCRIPTION,
  alternates: { canonical: `${brand.url}/calculators/numerology` },
  openGraph: { title: "Numerology Calculator | Tarun Astro", description: DESCRIPTION, url: `${brand.url}/calculators/numerology` },
};

const FAQS = [
  {
    question:
      "Which numerology system is this?",
    answer:
      "Chaldean. The letter values run 1 to 8, with 9 left unassigned. This differs from Pythagorean numerology, and the two give different name numbers, so we never combine them.",
  },
  {
    question:
      "Are master numbers reduced?",
    answer:
      "In the Life Path and the name-based numbers, 11, 22 and 33 are preserved. In the Birth Number they are reduced, so being born on the 29th gives a Mulank of 2 rather than 11.",
  },
  {
    question:
      "Why is the working shown?",
    answer:
      "Because numerology is arithmetic, and you should be able to check it. Every number lists the sum and reduction that produced it.",
  },
];

const BREADCRUMB = [
  { label: "Home", href: "/" },
  { label: "Calculators", href: "/calculators" },
  { label: "Numerology" },
];

export default function Page() {
  return (
    <>
      <ToolApplicationSchema description={DESCRIPTION} name="Numerology Calculator" path="/calculators/numerology" />
      <ToolBreadcrumbSchema items={BREADCRUMB} />
      <CalculatorFaqSchema faqs={FAQS} />

      <CalculatorShell
        breadcrumb={BREADCRUMB}
        compact
        faqs={FAQS}
        form={<NumerologyForm />}
        intro="Your numbers are derived from your date of birth and, optionally, your name. Every figure shows the arithmetic that produced it."
        methodology={
          <p>
            The calculator uses Chaldean values and deterministic arithmetic. Life Path reduces day, month and year separately, while name-based numbers preserve master numbers where the documented method allows them.
          </p>
        }
        related={
          <ReportUpsell
            body="A full numerology report interprets these numbers together rather than one at a time. It is not on sale yet, and we will not list it until the engine behind it is complete."
            compact
            cta="Browse available reports"
            heading="A written numerology reading"
            href="/reports"
          />
        }
        title="Numerology Calculator"
      />
    </>
  );
}
