import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";
import { PUBLIC_TOOL_PATHS } from "@/config/calculators";
import { SIGN_PROFILES } from "@/lib/astrology/horoscope";

/**
 * Public routes only.
 *
 * Private results, account pages, cart, checkout and anything carrying birth
 * data are deliberately absent. Tool pages are single strong landing pages; we
 * do not enumerate date or location permutations, which would be thin content.
 */
const staticRoutes = ["", "/kundli", "/reports", "/shop", "/calculators"];

const signRoutes = SIGN_PROFILES.map((profile) => `/horoscope/${profile.slug}`);

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [...new Set([...staticRoutes, ...PUBLIC_TOOL_PATHS, ...signRoutes])];

  return routes.map((route) => ({
    url: `${brand.url}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : route.split("/").length > 2 ? 0.6 : 0.8,
  }));
}
