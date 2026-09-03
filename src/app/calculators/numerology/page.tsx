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
  openGraph: { title: "Numerology Calculator | Ravish Astro", description: DESCRIPTION, url: `${brand.url}/calculators/numerology` },
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
        faqs={FAQS}
        form={<NumerologyForm />}
        intro="Your numbers are derived from your date of birth and, optionally, your name. Every figure shows the arithmetic that produced it."
        methodology={
          <>
            <p>
              This calculator uses the Chaldean system throughout. Chaldean assigns letter values from 1 to 8 only, treating 9 as sacred and unassigned, and it is the system in common use in India. It is never mixed with Pythagorean values.
            </p>
            <p>
              The Life Path reduces the day, month and year separately, then sums and reduces the three. Master numbers 11, 22 and 33 are preserved wherever they appear. The Birth Number is the day of the month reduced to a single digit, where master numbers are not preserved, following traditional Indian practice.
            </p>
            <p>
              All arithmetic is plain deterministic code. No language model is involved in producing any number here, and the working is printed with each result so you can verify it by hand.
            </p>
          </>
        }
        related={
          <ReportUpsell
            body="A full numerology report interprets these numbers together rather than one at a time. It is not on sale yet, and we will not list it until the engine behind it is complete."
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
