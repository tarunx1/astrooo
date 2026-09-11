import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";
import { PUBLIC_TOOL_PATHS } from "@/config/calculators";
import { SIGN_PROFILES } from "@/lib/astrology/horoscope";
import { listArticleCategories, listArticles } from "@/lib/content/articles";
import { listCourses } from "@/lib/content/courses";
import { listPujas } from "@/lib/puja/catalog";
import { listDirectory } from "@/lib/consultations/directory";
import { listReportSlugs } from "@/lib/reports/catalog";
import { logger } from "@/lib/observability/logger";

/**
 * Public routes only.
 *
 * Private results, account pages, cart, checkout, the staff dashboards and
 * anything carrying birth data are deliberately absent. Tool pages are single
 * strong landing pages; we do not enumerate date or location permutations,
 * which would be thin content.
 *
 * The dynamic entries are read from the database rather than listed by hand, so
 * a practitioner who is suspended, an article that is unpublished and a puja
 * that is deactivated all leave the sitemap by the same act that removes them
 * from the site. A hand-maintained list would keep advertising them.
 *
 * Search is absent on purpose: indexing arbitrary query strings is exactly the
 * thin-content pattern the content rules forbid, and `/search` is `noindex`.
 */
const STATIC_ROUTES = [
  "",
  "/kundli",
  "/reports",
  "/shop",
  "/calculators",
  "/consultations",
  "/puja",
  "/articles",
  "/courses",
  "/become-a-pandit",
];

/** How many of each dynamic kind to include. Bounded, so the file stays sane. */
const DYNAMIC_LIMIT = 200;

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const signRoutes = SIGN_PROFILES.map((profile) => `/horoscope/${profile.slug}`);

  /**
   * A sitemap that throws takes the route down.
   *
   * Each source is allowed to fail independently: a database hiccup should cost
   * some entries, not the whole file. The failure is logged rather than
   * swallowed silently so it is visible if it persists.
   */
  const safely = async <T>(label: string, load: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await load();
    } catch (error) {
      logger.warn("sitemap_source_failed", {
        source: label,
        errorName: error instanceof Error ? error.name : "unknown",
      });
      return [];
    }
  };

  const [reportSlugs, pandits, pujas, articles, articleCategories, courses] = await Promise.all([
    safely("reports", () => listReportSlugs()),
    safely("pandits", async () => (await listDirectory({ pageSize: 48 })).rows),
    safely("pujas", () => listPujas({ limit: DYNAMIC_LIMIT })),
    safely("articles", async () => (await listArticles({ pageSize: 48 })).rows),
    safely("article-categories", () => listArticleCategories()),
    safely("courses", () => listCourses()),
  ]);

  const dynamicRoutes = [
    ...reportSlugs.map((slug) => `/reports/${slug}`),
    ...pandits.map((pandit) => `/consultations/${pandit.slug}`),
    ...pujas.map((puja) => `/puja/${puja.slug}`),
    ...articles.map((article) => `/articles/${article.slug}`),
    ...articleCategories.map((category) => `/articles/category/${category.slug}`),
    ...courses.map((course) => `/courses/${course.slug}`),
  ];

  const routes = [...new Set([...STATIC_ROUTES, ...PUBLIC_TOOL_PATHS, ...signRoutes, ...dynamicRoutes])];

  return routes.map((route) => ({
    url: `${brand.url}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : route.split("/").length > 2 ? 0.6 : 0.8,
  }));
}
