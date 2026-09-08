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
import { ZodiacReveal, ZodiacRevealProvider } from "@/components/visuals/zodiac-reveal";

export const metadata: Metadata = {
  title: "Tarun Astro",
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
      <HeroSection />
      {/* Each wrapped section steps aside in turn - left, then right, and on
          down the page - so the sign forms in the half it frees. */}
      <ZodiacRevealProvider>
        <ZodiacReveal index={0}>
          <ServicesSection />
        </ZodiacReveal>
        <ZodiacReveal index={1}>
          <CalculatorAndPanchang />
        </ZodiacReveal>
        <ZodiacReveal index={2}>
          <ReportsSection />
        </ZodiacReveal>
        <ZodiacReveal index={3}>
          <ShopSection />
        </ZodiacReveal>
        <ZodiacReveal index={4}>
          <ConsultationSection />
        </ZodiacReveal>
        <ZodiacReveal index={5}>
          <TrustSection />
        </ZodiacReveal>
        <InsightsSection />
      </ZodiacRevealProvider>
    </>
  );
}
