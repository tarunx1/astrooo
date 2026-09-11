import "server-only";

import { ArticleStatus, PanditOnboardingStatus, ProductType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ASTROLOGY_TOOLS } from "@/config/calculators";

/**
 * Site search.
 *
 * Backed by the database this application already has, not by a search service.
 * At this catalogue's size an `ILIKE` across a handful of indexed tables is
 * both adequate and honest; introducing Elasticsearch or Algolia now would add
 * an operational dependency, a sync problem and a second source of truth for
 * what is published, in exchange for nothing a visitor would notice.
 *
 * `SearchProvider` is the seam. When result quality genuinely stops being good
 * enough, a provider-backed implementation slots in behind this interface and
 * the pages do not change.
 *
 * The rule every query here obeys: search sees exactly what the public sees. A
 * draft article, an inactive product, an unapproved practitioner and an
 * unpublished puja are all absent - filtered in the `where` clause, not after.
 */
export type SearchResultType =
  | "product"
  | "gemstone"
  | "pandit"
  | "puja"
  | "article"
  | "calculator"
  | "report";

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  description: string;
  href: string;
  /** Rendered as a small label on the result. */
  badge?: string;
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
  total: number;
  countsByType: Partial<Record<SearchResultType, number>>;
};

export interface SearchProvider {
  search(input: {
    query: string;
    type?: SearchResultType;
    limit?: number;
  }): Promise<SearchResponse>;
}

export const SEARCH_TYPE_LABEL: Record<SearchResultType, string> = {
  product: "Store",
  gemstone: "Gemstone",
  pandit: "Astrologer",
  puja: "Puja",
  article: "Article",
  calculator: "Free tool",
  report: "Report",
};

/** Per-type cap, so one crowded type cannot fill the whole page. */
const PER_TYPE_LIMIT = 8;

/**
 * Database-backed search.
 *
 * Each resource is queried independently rather than through a union, because
 * the public predicate differs per resource - and expressing each one where it
 * belongs is what keeps an unpublished thing from leaking into results.
 */
class DatabaseSearchProvider implements SearchProvider {
  async search(input: {
    query: string;
    type?: SearchResultType;
    limit?: number;
  }): Promise<SearchResponse> {
    const query = input.query.trim();

    if (query.length < 2) {
      return { query, results: [], total: 0, countsByType: {} };
    }

    const limit = Math.min(PER_TYPE_LIMIT, input.limit ?? PER_TYPE_LIMIT);
    const wanted = input.type;
    const now = new Date();

    const [products, gemstones, pandits, pujas, articles, reports] = await Promise.all([
      wanted && wanted !== "product" ? [] : this.products(query, limit, ProductType.PHYSICAL),
      wanted && wanted !== "gemstone" ? [] : this.products(query, limit, ProductType.GEMSTONE),
      wanted && wanted !== "pandit" ? [] : this.pandits(query, limit),
      wanted && wanted !== "puja" ? [] : this.pujas(query, limit),
      wanted && wanted !== "article" ? [] : this.articles(query, limit, now),
      wanted && wanted !== "report" ? [] : this.reports(query, limit),
    ]);

    const calculatorResults = wanted && wanted !== "calculator" ? [] : this.calculators(query, limit);

    const grouped: SearchResult[] = [
      ...pandits,
      ...articles,
      ...calculatorResults,
      ...reports,
      ...pujas,
      ...gemstones,
      ...products,
    ];

    const countsByType: Partial<Record<SearchResultType, number>> = {};
    for (const result of grouped) {
      countsByType[result.type] = (countsByType[result.type] ?? 0) + 1;
    }

    return { query, results: grouped, total: grouped.length, countsByType };
  }

  private async products(query: string, limit: number, type: ProductType): Promise<SearchResult[]> {
    const rows = await prisma.product.findMany({
      where: {
        type,
        active: true,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { id: true, slug: true, title: true, description: true, category: { select: { name: true } } },
      take: limit,
    });

    return rows.map((row) => ({
      id: `product-${row.id}`,
      type: type === ProductType.GEMSTONE ? ("gemstone" as const) : ("product" as const),
      title: row.title,
      description: row.description.slice(0, 160),
      href: `/product/${row.slug}`,
      badge: row.category?.name ?? undefined,
    }));
  }

  private async pandits(query: string, limit: number): Promise<SearchResult[]> {
    const rows = await prisma.panditProfile.findMany({
      where: {
        // The same public predicate the directory uses.
        status: PanditOnboardingStatus.ACTIVE,
        slug: { not: null },
        OR: [
          { displayName: { contains: query, mode: "insensitive" } },
          { headline: { contains: query, mode: "insensitive" } },
          { city: { contains: query, mode: "insensitive" } },
          { expertise: { has: query } },
          { languages: { has: query } },
        ],
      },
      select: { id: true, slug: true, displayName: true, headline: true, expertise: true },
      take: limit,
    });

    return rows.map((row) => ({
      id: `pandit-${row.id}`,
      type: "pandit" as const,
      title: row.displayName,
      description: row.headline ?? row.expertise.slice(0, 3).join(", "),
      href: `/consultations/${row.slug}`,
      badge: "Verified",
    }));
  }

  private async pujas(query: string, limit: number): Promise<SearchResult[]> {
    const rows = await prisma.puja.findMany({
      where: {
        active: true,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { purpose: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { id: true, slug: true, title: true, shortDescription: true, description: true },
      take: limit,
    });

    return rows.map((row) => ({
      id: `puja-${row.id}`,
      type: "puja" as const,
      title: row.title,
      description: (row.shortDescription || row.description).slice(0, 160),
      href: `/puja/${row.slug}`,
    }));
  }

  private async articles(query: string, limit: number, now: Date): Promise<SearchResult[]> {
    const rows = await prisma.article.findMany({
      where: {
        // Both conditions, exactly as the article queries require.
        status: ArticleStatus.PUBLISHED,
        publishedAt: { not: null, lte: now },
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { excerpt: { contains: query, mode: "insensitive" } },
          { content: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        content: true,
        articleCategory: { select: { name: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
    });

    return rows.map((row) => ({
      id: `article-${row.id}`,
      type: "article" as const,
      title: row.title,
      description: (row.excerpt ?? row.content.replace(/\s+/g, " ")).slice(0, 160),
      href: `/articles/${row.slug}`,
      badge: row.articleCategory?.name ?? undefined,
    }));
  }

  private async reports(query: string, limit: number): Promise<SearchResult[]> {
    const rows = await prisma.reportDefinition.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { shortDescription: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { id: true, slug: true, name: true, shortDescription: true },
      take: limit,
    });

    return rows.map((row) => ({
      id: `report-${row.id}`,
      type: "report" as const,
      title: row.name,
      description: row.shortDescription.slice(0, 160),
      href: `/reports/${row.slug}`,
    }));
  }

  /**
   * Calculators are code, not rows.
   *
   * They are declared in configuration, so they are matched in memory. The list
   * is short and fixed, which is why this is not a database concern.
   */
  private calculators(query: string, limit: number): SearchResult[] {
    const needle = query.toLowerCase();

    return ASTROLOGY_TOOLS
      // `isPublic` is the same flag that governs the hub and the sitemap, so a
      // tool that is not listed publicly is not findable here either.
      .filter((tool) => tool.isPublic)
      .filter(
        (tool) =>
          tool.title.toLowerCase().includes(needle) ||
          tool.shortDescription.toLowerCase().includes(needle),
      )
      .slice(0, limit)
      .map((tool) => ({
        id: `calculator-${tool.slug}`,
        type: "calculator" as const,
        title: tool.title,
        description: tool.shortDescription,
        href: tool.href,
        badge: "Free",
      }));
  }
}

let provider: SearchProvider | null = null;

/**
 * The configured search provider.
 *
 * One place to swap the implementation. Nothing above the interface knows which
 * one is in use.
 */
export function getSearchProvider(): SearchProvider {
  provider ??= new DatabaseSearchProvider();
  return provider;
}

export async function search(input: {
  query: string;
  type?: SearchResultType;
  limit?: number;
}): Promise<SearchResponse> {
  return getSearchProvider().search(input);
}
