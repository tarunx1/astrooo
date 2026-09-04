import type { Metadata } from "next";
import { CalculatorAndPanchang } from "@/components/sections/calculator-and-panchang";
import { ConsultationSection } from "@/components/sections/consultation-section";
import { HeroSection } from "@/components/sections/hero-section";
import { InsightsSection } from "@/components/sections/insights-section";
import { ReportsSection } from "@/components/sections/reports-section";
import { ServicesSection } from "@/components/sections/services-section";
import { ShopSection } from "@/components/sections/shop-section";
import { TrustSection } from "@/components/sections/trust-section";
import { createOrganizationJsonLd, createWebsiteJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { ZodiacScroll } from "@/components/visuals/zodiac-scroll";
import { ZodiacBand } from "@/components/sections/zodiac-band";

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
       
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <ZodiacScroll />
      <HeroSection />
      <ServicesSection />
      <CalculatorAndPanchang />
      <ReportsSection />
      <ZodiacBand />
      <ShopSection />
      <ConsultationSection />
      <TrustSection />
      <InsightsSection />
    </>
  );
}
