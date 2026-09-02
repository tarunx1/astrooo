import type { Metadata } from "next";
import { CalculatorAndPanchang } from "@/components/sections/calculator-and-panchang";
import { ConsultationSection } from "@/components/sections/consultation-section";
import { HeroSection } from "@/components/sections/hero-section";
import { InsightsSection } from "@/components/sections/insights-section";
import { ReportsSection } from "@/components/sections/reports-section";
import { ServicesSection } from "@/components/sections/services-section";
import { ShopSection } from "@/components/sections/shop-section";
import { TrustSection } from "@/components/sections/trust-section";
import { createOrganizationJsonLd, createWebsiteJsonLd } from "@/lib/seo/json-ld";

export const metadata: Metadata = {
  title: "Ravish Astro",
  description:
    "Generate a free Kundli, explore personalized astrology reports, consult verified astrologers, and shop gemstones through a premium Vedic astrology platform.",
};

export default function HomePage() {
  const jsonLd = [createOrganizationJsonLd(), createWebsiteJsonLd()];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HeroSection />
      <ServicesSection />
      <CalculatorAndPanchang />
      <ReportsSection />
      <ShopSection />
      <ConsultationSection />
      <TrustSection />
      <InsightsSection />
    </>
  );
}
