import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, Section, SectionHeader } from "@/components/layout/primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { ArticleGrid } from "@/components/content/article-card";
import { ARTICLES_PAGE_SIZE, listArticleCategories, listArticles } from "@/lib/content/articles";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Astrology Guides & Articles",
  description:
    "Practical Vedic astrology guides written to be understood: charts, doshas, remedies and timing, explained without mystification.",
  alternates: { canonical: `${brand.url}/articles` },
};

/**
 * The article index.
 *
 * Server-rendered so the writing is indexable. Only published articles with a
 * date that has passed are queried, so drafts and scheduled pieces are absent
 * rather than filtered out here.
 */
export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Number(raw ?? 1) || 1);

  const [{ rows, total }, categories] = await Promise.all([
    listArticles({ page, pageSize: ARTICLES_PAGE_SIZE }),
    listArticleCategories(),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / ARTICLES_PAGE_SIZE));

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <SectionHeader
          text="Guides to the parts of Vedic astrology people actually ask about, written to be understood rather than to impress."
          title="Articles"
        />

        {categories.length > 0 ? (
          <nav aria-label="Article categories" className="mb-8">
            <ul className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground-secondary transition hover:border-primary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                    href={`/articles/category/${category.slug}`}
                    prefetch={false}
                  >
                    {category.name}
                    <span className="caption text-foreground-muted">{category.articleCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {rows.length === 0 ? (
          <EmptyState
            message="Our guides are being written. Please check back shortly."
            title="No articles published yet"
          />
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
                  href={page === 2 ? "/articles" : `/articles?page=${page - 1}`}
                  rel="prev"
                >
                  Previous
                </Link>
              ) : null}
              {page < pageCount ? (
                <Link
                  className="inline-flex min-h-10 items-center rounded-md border border-border px-4 body-sm font-semibold text-foreground-secondary transition hover:border-border-strong hover:text-foreground"
                  href={`/articles?page=${page + 1}`}
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
