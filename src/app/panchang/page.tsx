import type { Metadata } from "next";
import { CalculatorFaqSchema, CalculatorShell, ToolApplicationSchema, ToolBreadcrumbSchema } from "@/components/tools/calculator-shell";
import { PanchangForm } from "@/components/tools/panchang-form";
import { brand } from "@/config/brand";

const DESCRIPTION =
  "Free daily Panchang. Choose any date and place for the Tithi, Nakshatra, Yoga, Karana, Vara, lunar month and sunrise, calculated for that location's own timezone.";

export const metadata: Metadata = {
  title: "Panchang | Daily Tithi, Nakshatra and Yoga",
  description: DESCRIPTION,
  alternates: { canonical: `${brand.url}/panchang` },
  openGraph: {
    title: "Panchang | Tarun Astro",
    description: DESCRIPTION,
    url: `${brand.url}/panchang`,
    type: "website",
  },
};

const FAQS = [
  {
    question: "What are the five limbs of the Panchang?",
    answer:
      "Panchang means five limbs: Tithi (lunar day), Vara (weekday), Nakshatra (the Moon's constellation), Yoga (a combination of solar and lunar longitudes) and Karana (half a Tithi). All five are shown here.",
  },
  {
    question: "Why is the Panchang different for different cities?",
    answer:
      "The five limbs change through the day, and sunrise differs by place. We calculate for the local calendar day at the place you choose, using that location's own timezone rather than a server clock.",
  },
  {
    question: "Why are Rahu Kaal and moonrise not shown?",
    answer:
      "Our calculation engine does not compute them. We would rather leave a value out than display an estimate that looks authoritative. They are listed under 'Not included' on the result so you know they were not calculated rather than simply missing.",
  },
];

const BREADCRUMB = [{ label: "Home", href: "/" }, { label: "Panchang" }];

export default function PanchangPage() {
  // Server-rendered default only; the user can pick any date.
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <ToolApplicationSchema description={DESCRIPTION} name="Panchang" path="/panchang" />
      <ToolBreadcrumbSchema items={BREADCRUMB} />
      <CalculatorFaqSchema faqs={FAQS} />

      <CalculatorShell
        breadcrumb={BREADCRUMB}
        faqs={FAQS}
        form={<PanchangForm defaultDate={today} />}
        intro="Choose a date and a place for that day's Panchang. Everything shown is calculated for the local calendar day at the location you pick."
        methodology={
          <>
            <p>
              The place you choose resolves to coordinates and an IANA timezone through the same location service our
              birth tools use. The Panchang is then calculated at local noon on your chosen date, which guarantees the
              instant falls inside that local calendar day whatever the UTC offset or daylight saving rule.
            </p>
            <p>
              Sunrise and sunset are returned as local wall-clock times for that place. Calculations use the Lahiri
              ayanamsa on a sidereal zodiac.
            </p>
            <p>
              Only values the engine actually calculates are displayed. Anything it does not compute is listed
              explicitly as not included rather than estimated.
            </p>
          </>
        }
        title="Panchang"
      />
    </>
  );
}
