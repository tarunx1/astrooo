import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer, Section, SectionHeader } from "@/components/layout/primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { ArticleGrid } from "@/components/content/article-card";
import { ARTICLES_PAGE_SIZE, getArticleCategory, listArticles } from "@/lib/content/articles";
import { brand } from "@/config/brand";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getArticleCategory(slug);

  if (!category) return { title: "Category not found", robots: { index: false, follow: false } };

  return {
    title: `${category.name} | Astrology Guides`,
    description:
      category.description ?? `Articles and guides on ${category.name.toLowerCase()} from Tarun Astro.`,
    alternates: { canonical: `${brand.url}/articles/category/${category.slug}` },
  };
}

/** One editorial category. */
export default async function ArticleCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const raw = Array.isArray(query.page) ? query.page[0] : query.page;
  const page = Math.max(1, Number(raw ?? 1) || 1);

  const category = await getArticleCategory(slug);
  if (!category) notFound();

  const { rows, total } = await listArticles({
    page,
    pageSize: ARTICLES_PAGE_SIZE,
    categorySlug: slug,
  });

  const pageCount = Math.max(1, Math.ceil(total / ARTICLES_PAGE_SIZE));

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <nav aria-label="Breadcrumb" className="mb-6">
          <Link className="caption text-foreground-muted underline transition hover:text-foreground" href="/articles">
            ← All articles
          </Link>
        </nav>

        <SectionHeader
          text={category.description ?? undefined}
          title={category.name}
        />

        {rows.length === 0 ? (
          <EmptyState message="Nothing published in this category yet." title="No articles" />
        ) : (
          <ArticleGrid articles={rows} />
        )}

        {pageCount > 1 ? (
          <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-3">
            <p className="caption text-foreground-muted">
              Page {page} of {pageCount}
            </p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  className="inline-flex min-h-10 items-center rounded-md border border-border px-4 body-sm font-semibold text-foreground-secondary transition hover:border-border-strong hover:text-foreground"
                  href={page === 2 ? `/articles/category/${slug}` : `/articles/category/${slug}?page=${page - 1}`}
                  rel="prev"
                >
                  Previous
                </Link>
              ) : null}
              {page < pageCount ? (
                <Link
                  className="inline-flex min-h-10 items-center rounded-md border border-border px-4 body-sm font-semibold text-foreground-secondary transition hover:border-border-strong hover:text-foreground"
                  href={`/articles/category/${slug}?page=${page + 1}`}
                  rel="next"
                >
                  Next
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </PageContainer>
    </Section>
  );
}
