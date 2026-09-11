import "server-only";

import { ArticleStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

/**
 * Editorial content.
 *
 * Two conditions make an article public, and both are in every public `where`
 * clause: `status = PUBLISHED` and a `publishedAt` that has already passed.
 * Requiring both is what lets an editor schedule a piece - mark it published
 * now, dated for Friday - without a second mechanism, and it means a draft is
 * invisible by construction rather than by each page remembering to check.
 */
const PUBLIC_WHERE = (now: Date): Prisma.ArticleWhereInput => ({
  status: ArticleStatus.PUBLISHED,
  publishedAt: { not: null, lte: now },
});

export type ArticleCardData = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  publishedAt: Date;
  authorName: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  readingMinutes: number;
  tags: string[];
};

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  content: true,
  coverImageUrl: true,
  publishedAt: true,
  authorName: true,
  tags: true,
  articleCategory: { select: { name: true, slug: true } },
} satisfies Prisma.ArticleSelect;

type CardRow = Prisma.ArticleGetPayload<{ select: typeof CARD_SELECT }>;

/**
 * A reading estimate.
 *
 * Derived from the text rather than stored, so it cannot drift from the
 * content after an edit. 200 words a minute is the conventional figure; the
 * point is a rough signal, not a measurement, so it is floored at one minute.
 */
export function readingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function toCard(row: CardRow): ArticleCardData {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    // Falls back to the opening of the body rather than rendering an empty
    // card for a piece whose excerpt was never filled in.
    excerpt: row.excerpt?.trim() || `${row.content.replace(/\s+/g, " ").slice(0, 160)}…`,
    coverImageUrl: row.coverImageUrl,
    // Non-null by the query.
    publishedAt: row.publishedAt!,
    authorName: row.authorName,
    categoryName: row.articleCategory?.name ?? null,
    categorySlug: row.articleCategory?.slug ?? null,
    readingMinutes: readingMinutes(row.content),
    tags: row.tags,
  };
}

export const ARTICLES_PAGE_SIZE = 12;

export async function listArticles(input?: {
  page?: number;
  pageSize?: number;
  categorySlug?: string;
  q?: string;
  now?: Date;
}): Promise<{ rows: ArticleCardData[]; total: number; page: number; pageSize: number }> {
  const now = input?.now ?? new Date();
  const page = Math.max(1, input?.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, input?.pageSize ?? ARTICLES_PAGE_SIZE));
  const search = input?.q?.trim();

  const where: Prisma.ArticleWhereInput = {
    ...PUBLIC_WHERE(now),
    ...(input?.categorySlug ? { articleCategory: { slug: input.categorySlug } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { excerpt: { contains: search, mode: "insensitive" } },
            { content: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.article.findMany({
      where,
      select: CARD_SELECT,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.article.count({ where }),
  ]);

  return { rows: rows.map(toCard), total, page, pageSize };
}

export type ArticleDetailData = ArticleCardData & {
  content: string;
  updatedAt: Date;
  seoTitle: string | null;
  seoDescription: string | null;
};

/** One published article, by slug. Returns null for a draft or a future date. */
export async function getArticle(slug: string, now: Date = new Date()): Promise<ArticleDetailData | null> {
  const row = await prisma.article.findFirst({
    where: { slug, ...PUBLIC_WHERE(now) },
    select: { ...CARD_SELECT, updatedAt: true, seoTitle: true, seoDescription: true },
  });

  if (!row) return null;

  return {
    ...toCard(row),
    content: row.content,
    updatedAt: row.updatedAt,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
  };
}

/** Other published pieces in the same category, for further reading. */
export async function relatedArticles(input: {
  articleId: string;
  categorySlug: string | null;
  limit?: number;
  now?: Date;
}): Promise<ArticleCardData[]> {
  const now = input.now ?? new Date();

  const rows = await prisma.article.findMany({
    where: {
      ...PUBLIC_WHERE(now),
      id: { not: input.articleId },
      ...(input.categorySlug ? { articleCategory: { slug: input.categorySlug } } : {}),
    },
    select: CARD_SELECT,
    orderBy: { publishedAt: "desc" },
    take: input.limit ?? 3,
  });

  return rows.map(toCard);
}

/** Categories that actually have something published in them. */
export async function listArticleCategories(now: Date = new Date()): Promise<
  Array<{ name: string; slug: string; description: string | null; articleCount: number }>
> {
  const rows = await prisma.articleCategory.findMany({
    select: {
      name: true,
      slug: true,
      description: true,
      _count: { select: { articles: { where: PUBLIC_WHERE(now) } } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return rows
    .filter((row) => row._count.articles > 0)
    .map((row) => ({
      name: row.name,
      slug: row.slug,
      description: row.description,
      articleCount: row._count.articles,
    }));
}

export async function getArticleCategory(
  slug: string,
): Promise<{ name: string; slug: string; description: string | null } | null> {
  return prisma.articleCategory.findUnique({
    where: { slug },
    select: { name: true, slug: true, description: true },
  });
}

/* ------------------------------------------------------------------ */
/* Editorial administration                                            */
/* ------------------------------------------------------------------ */

export const articleInputSchema = z.object({
  title: z.string().trim().min(4).max(200),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by single hyphens."),
  excerpt: z.string().trim().max(400).nullable(),
  content: z.string().trim().min(50).max(200_000),
  coverImageUrl: z.string().trim().url().max(500).nullable(),
  authorName: z.string().trim().max(120).nullable(),
  articleCategoryId: z.string().trim().min(1).max(64).nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  seoTitle: z.string().trim().max(200).nullable(),
  seoDescription: z.string().trim().max(300).nullable(),
});

export type ArticleInput = z.infer<typeof articleInputSchema>;

export type ArticleMutationResult =
  | { ok: true; articleId: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function createArticle(input: ArticleInput): Promise<ArticleMutationResult> {
  const existing = await prisma.article.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (existing) {
    return { ok: false, message: "That slug is already in use.", fieldErrors: { slug: ["Already in use."] } };
  }

  const article = await prisma.article.create({
    // Always created as a draft. Publishing is a separate, deliberate act.
    data: { ...input, status: ArticleStatus.DRAFT },
    select: { id: true },
  });

  return { ok: true, articleId: article.id };
}

export async function updateArticle(
  articleId: string,
  input: ArticleInput,
): Promise<ArticleMutationResult> {
  const clash = await prisma.article.findFirst({
    where: { slug: input.slug, id: { not: articleId } },
    select: { id: true },
  });

  if (clash) {
    return { ok: false, message: "That slug is already in use.", fieldErrors: { slug: ["Already in use."] } };
  }

  await prisma.article.update({ where: { id: articleId }, data: input });
  return { ok: true, articleId };
}

/**
 * Moves an article between draft, published and archived.
 *
 * Publishing stamps `publishedAt` the first time only, so re-publishing an
 * archived piece keeps its original date rather than presenting old writing as
 * new.
 */
export async function setArticleStatus(input: {
  articleId: string;
  status: ArticleStatus;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const article = await prisma.article.findUnique({
    where: { id: input.articleId },
    select: { id: true, publishedAt: true, content: true, title: true },
  });

  if (!article) return { ok: false, message: "That article could not be found." };

  if (input.status === ArticleStatus.PUBLISHED && article.content.trim().length < 50) {
    return { ok: false, message: "Write the article before publishing it." };
  }

  await prisma.article.update({
    where: { id: article.id },
    data: {
      status: input.status,
      ...(input.status === ArticleStatus.PUBLISHED && !article.publishedAt
        ? { publishedAt: new Date() }
        : {}),
    },
  });

  return { ok: true };
}

export type AdminArticleRow = {
  id: string;
  title: string;
  slug: string;
  status: ArticleStatus;
  publishedAt: Date | null;
  categoryName: string | null;
  updatedAt: Date;
};

/** Editorial listing. Includes drafts, which the public queries never do. */
export async function listArticlesForAdmin(input: {
  page: number;
  pageSize: number;
  status?: ArticleStatus;
  search?: string;
}): Promise<{ rows: AdminArticleRow[]; total: number }> {
  const where: Prisma.ArticleWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.search
      ? {
          OR: [
            { title: { contains: input.search, mode: "insensitive" } },
            { slug: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.article.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
        articleCategory: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.article.count({ where }),
  ]);

  return {
    total,
    rows: rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      publishedAt: row.publishedAt,
      categoryName: row.articleCategory?.name ?? null,
      updatedAt: row.updatedAt,
    })),
  };
}

export async function getArticleForAdmin(articleId: string) {
  return prisma.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      status: true,
      publishedAt: true,
      coverImageUrl: true,
      authorName: true,
      articleCategoryId: true,
      tags: true,
      seoTitle: true,
      seoDescription: true,
    },
  });
}
