import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/cart", "/checkout", "/account", "/admin", "/sign-in", "/kundli/result"],
    },
    sitemap: `${brand.url}/sitemap.xml`,
  };
}
