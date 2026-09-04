import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/layout/site-footer";
import { StarFieldBackground } from "@/components/visuals/star-field-background";
import { SiteHeader } from "@/components/navigation/site-header";
import { brand } from "@/config/brand";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(brand.url),
  title: {
    default: brand.seo.defaultTitle,
    template: brand.seo.titleTemplate,
  },
  description: brand.seo.defaultDescription,
  openGraph: {
    title: brand.seo.defaultTitle,
    description: brand.seo.defaultDescription,
    url: brand.url,
    siteName: brand.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: brand.seo.defaultTitle,
    description: brand.seo.defaultDescription,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={brand.business.locale} className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full" suppressHydrationWarning>
        <StarFieldBackground />
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
