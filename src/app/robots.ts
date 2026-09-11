import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Every private area is listed here as well as being `noindex` in its own
      // layout metadata. Two independent statements, because a crawler that
      // ignores one should still be told by the other.
      disallow: [
        "/cart",
        "/checkout",
        "/account",
        "/admin",
        "/employee",
        "/pandit",
        "/sign-in",
        "/post-login",
        "/kundli/result",
        "/api/pandit-documents",
      ],
    },
    sitemap: `${brand.url}/sitemap.xml`,
  };
}
