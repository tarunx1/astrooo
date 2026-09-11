import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ArticleStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  createArticle,
  getArticle,
  listArticleCategories,
  listArticles,
  listArticlesForAdmin,
  readingMinutes,
  relatedArticles,
  setArticleStatus,
  updateArticle,
} from "@/lib/content/articles";
import { parseArticleBody } from "@/components/content/article-body";

/**
 * Editorial content.
 *
 * The property that matters most: a draft is never public, through any path.
 * The others follow from it - a scheduled piece stays hidden until its date, an
 * archived one stops being public without being deleted, and the first publish
 * date is never rewritten by a later one.
 */
const RUN = `art${Date.now().toString(36)}`;

let categoryId: string;
let categorySlug: string;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set for article tests.");

  categorySlug = `${RUN}-guides`;

  const category = await prisma.articleCategory.create({
    data: { name: `Guides ${RUN}`, slug: categorySlug, description: "Testing category" },
    select: { id: true },
  });

  categoryId = category.id;
});

afterAll(async () => {
  await prisma.article.deleteMany({ where: { slug: { startsWith: RUN } } });
  await prisma.articleCategory.deleteMany({ where: { slug: { startsWith: RUN } } });
});

const body = "This is the article body. ".repeat(20);

async function makeArticle(label: string, overrides: { status?: ArticleStatus; publishedAt?: Date | null } = {}) {
  const created = await createArticle({
    title: `Article ${label}`,
    slug: `${RUN}-${label}`,
    excerpt: "A short excerpt.",
    content: body,
    coverImageUrl: null,
    authorName: "Test Author",
    articleCategoryId: categoryId,
    tags: ["testing"],
    seoTitle: null,
    seoDescription: null,
  });

  if (!created.ok) throw new Error(`setup failed: ${created.message}`);

  if (overrides.status || overrides.publishedAt !== undefined) {
    await prisma.article.update({
      where: { id: created.articleId },
      data: {
        ...(overrides.status ? { status: overrides.status } : {}),
        ...(overrides.publishedAt !== undefined ? { publishedAt: overrides.publishedAt } : {}),
      },
    });
  }

  return created.articleId;
}

describe("draft invisibility", () => {
  it("creates articles as drafts", async () => {
    const id = await makeArticle("draft-default");

    const row = await prisma.article.findUniqueOrThrow({
      where: { id },
      select: { status: true, publishedAt: true },
    });

    expect(row.status).toBe(ArticleStatus.DRAFT);
    expect(row.publishedAt).toBeNull();
  });

  it("never lists a draft", async () => {
    await makeArticle("hidden-draft");

    const { rows } = await listArticles({ pageSize: 48 });
    expect(rows.some((row) => row.slug === `${RUN}-hidden-draft`)).toBe(false);
  });

  it("never resolves a draft by slug", async () => {
    await makeArticle("draft-by-slug");
    expect(await getArticle(`${RUN}-draft-by-slug`)).toBeNull();
  });

  it("shows drafts to editors", async () => {
    await makeArticle("admin-visible");

    const { rows } = await listArticlesForAdmin({ page: 1, pageSize: 50, status: ArticleStatus.DRAFT });
    expect(rows.some((row) => row.slug === `${RUN}-admin-visible`)).toBe(true);
  });
});

describe("publishing", () => {
  it("publishes and becomes public", async () => {
    const id = await makeArticle("publish-me");

    const result = await setArticleStatus({ articleId: id, status: ArticleStatus.PUBLISHED });
    expect(result.ok).toBe(true);

    const article = await getArticle(`${RUN}-publish-me`);
    expect(article).not.toBeNull();
    expect(article?.title).toBe("Article publish-me");
  });

  it("refuses to publish an empty article", async () => {
    const created = await createArticle({
      title: "Too short",
      slug: `${RUN}-tooshort`,
      excerpt: null,
      content: "x".repeat(60),
      coverImageUrl: null,
      authorName: null,
      articleCategoryId: null,
      tags: [],
      seoTitle: null,
      seoDescription: null,
    });

    if (!created.ok) throw new Error("setup failed");

    // Emptied after creation, which is the state an editor could actually reach.
    await prisma.article.update({ where: { id: created.articleId }, data: { content: "short" } });

    const result = await setArticleStatus({
      articleId: created.articleId,
      status: ArticleStatus.PUBLISHED,
    });

    expect(result.ok).toBe(false);
  });

  it("keeps the original publish date when re-published", async () => {
    const id = await makeArticle("republish");

    await setArticleStatus({ articleId: id, status: ArticleStatus.PUBLISHED });

    const first = await prisma.article.findUniqueOrThrow({
      where: { id },
      select: { publishedAt: true },
    });

    await setArticleStatus({ articleId: id, status: ArticleStatus.ARCHIVED });
    await setArticleStatus({ articleId: id, status: ArticleStatus.PUBLISHED });

    const second = await prisma.article.findUniqueOrThrow({
      where: { id },
      select: { publishedAt: true },
    });

    // Old writing must not be presented as new.
    expect(second.publishedAt?.getTime()).toBe(first.publishedAt?.getTime());
  });

  it("hides an archived article from the public", async () => {
    const id = await makeArticle("archive-me");

    await setArticleStatus({ articleId: id, status: ArticleStatus.PUBLISHED });
    expect(await getArticle(`${RUN}-archive-me`)).not.toBeNull();

    await setArticleStatus({ articleId: id, status: ArticleStatus.ARCHIVED });
    expect(await getArticle(`${RUN}-archive-me`)).toBeNull();

    // Archiving is not deletion.
    const row = await prisma.article.findUnique({ where: { id }, select: { id: true } });
    expect(row).not.toBeNull();
  });

  it("hides a published article dated in the future", async () => {
    await makeArticle("scheduled", {
      status: ArticleStatus.PUBLISHED,
      publishedAt: new Date(Date.now() + 86_400_000),
    });

    expect(await getArticle(`${RUN}-scheduled`)).toBeNull();

    const { rows } = await listArticles({ pageSize: 48 });
    expect(rows.some((row) => row.slug === `${RUN}-scheduled`)).toBe(false);
  });

  it("shows it once the date passes", async () => {
    const future = new Date(Date.now() + 86_400_000);
    await makeArticle("scheduled-later", { status: ArticleStatus.PUBLISHED, publishedAt: future });

    // Asking as of a moment after the publication date.
    const article = await getArticle(`${RUN}-scheduled-later`, new Date(future.getTime() + 1_000));
    expect(article).not.toBeNull();
  });
});

describe("listing behaviour", () => {
  it("paginates", async () => {
    const first = await listArticles({ page: 1, pageSize: 1 });
    expect(first.rows.length).toBeLessThanOrEqual(1);
    expect(first.pageSize).toBe(1);
  });

  it("filters by category", async () => {
    const id = await makeArticle("in-category");
    await setArticleStatus({ articleId: id, status: ArticleStatus.PUBLISHED });

    const { rows } = await listArticles({ categorySlug, pageSize: 48 });
    expect(rows.every((row) => row.categorySlug === categorySlug)).toBe(true);
    expect(rows.some((row) => row.slug === `${RUN}-in-category`)).toBe(true);
  });

  it("searches titles and bodies", async () => {
    const id = await makeArticle("searchable");
    await prisma.article.update({
      where: { id },
      data: { content: `${body} A very distinctive ${RUN} phrase.` },
    });
    await setArticleStatus({ articleId: id, status: ArticleStatus.PUBLISHED });

    const { rows } = await listArticles({ q: `distinctive ${RUN}`, pageSize: 48 });
    expect(rows.some((row) => row.slug === `${RUN}-searchable`)).toBe(true);
  });

  it("only counts published articles in a category", async () => {
    await makeArticle("uncounted-draft");

    const categories = await listArticleCategories();
    const mine = categories.find((category) => category.slug === categorySlug);

    if (mine) {
      const published = await prisma.article.count({
        where: {
          articleCategoryId: categoryId,
          status: ArticleStatus.PUBLISHED,
          publishedAt: { not: null, lte: new Date() },
        },
      });
      expect(mine.articleCount).toBe(published);
    }
  });

  it("excludes the current article from related reading", async () => {
    const id = await makeArticle("related-source");
    await setArticleStatus({ articleId: id, status: ArticleStatus.PUBLISHED });

    const related = await relatedArticles({ articleId: id, categorySlug });
    expect(related.every((row) => row.id !== id)).toBe(true);
  });
});

describe("editing", () => {
  it("refuses a slug already in use", async () => {
    const first = await makeArticle("slug-a");
    await makeArticle("slug-b");

    const result = await updateArticle(first, {
      title: "Article slug-a",
      slug: `${RUN}-slug-b`,
      excerpt: null,
      content: body,
      coverImageUrl: null,
      authorName: null,
      articleCategoryId: null,
      tags: [],
      seoTitle: null,
      seoDescription: null,
    });

    expect(result.ok).toBe(false);
  });

  it("allows an article to keep its own slug", async () => {
    const id = await makeArticle("keeps-slug");

    const result = await updateArticle(id, {
      title: "Renamed",
      slug: `${RUN}-keeps-slug`,
      excerpt: null,
      content: body,
      coverImageUrl: null,
      authorName: null,
      articleCategoryId: null,
      tags: [],
      seoTitle: null,
      seoDescription: null,
    });

    expect(result.ok).toBe(true);
  });
});

describe("body rendering", () => {
  it("never emits raw HTML", () => {
    // Operator-entered content must not be able to inject script. The parser
    // produces text blocks, so markup arrives as literal text.
    const blocks = parseArticleBody('<script>alert(1)</script>\n\nSecond paragraph.');

    expect(blocks[0].kind).toBe("paragraph");
    expect(blocks[0]).toMatchObject({ text: "<script>alert(1)</script>" });
  });

  it("parses headings, lists and quotes", () => {
    const blocks = parseArticleBody(
      "## A heading\n\nSome prose.\n\n- one\n- two\n\n> a quotation",
    );

    expect(blocks[0]).toMatchObject({ kind: "heading", level: 2, text: "A heading" });
    expect(blocks[1]).toMatchObject({ kind: "paragraph" });
    expect(blocks[2]).toMatchObject({ kind: "list", items: ["one", "two"] });
    expect(blocks[3]).toMatchObject({ kind: "quote", text: "a quotation" });
  });

  it("keeps prose that follows a heading in the same block", () => {
    const blocks = parseArticleBody("### Sub\nFollowing prose.");
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toMatchObject({ kind: "paragraph", text: "Following prose." });
  });

  it("estimates reading time from the text", () => {
    expect(readingMinutes("word ".repeat(200))).toBe(1);
    expect(readingMinutes("word ".repeat(600))).toBe(3);
    // Never zero, however short.
    expect(readingMinutes("one")).toBe(1);
  });
});
