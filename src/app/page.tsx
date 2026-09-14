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
import { HomeChapter } from "@/components/home/home-chapter";

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
      <HomeChapter><ServicesSection /></HomeChapter>
      <HomeChapter tone="deep"><CalculatorAndPanchang /></HomeChapter>
      <HomeChapter reveal="report"><ReportsSection /></HomeChapter>
      <HomeChapter tone="surface" reveal="commerce"><ShopSection /></HomeChapter>
      <HomeChapter tone="deep" reveal="portrait"><ConsultationSection /></HomeChapter>
      <HomeChapter><TrustSection /></HomeChapter>
      <HomeChapter tone="surface"><InsightsSection /></HomeChapter>
    </>
  );
}
