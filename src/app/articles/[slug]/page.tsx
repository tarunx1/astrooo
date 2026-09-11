import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock } from "lucide-react";
import { PageContainer, Section } from "@/components/layout/primitives";
import { ArticleBody } from "@/components/content/article-body";
import { ArticleGrid } from "@/components/content/article-card";
import { getArticle, relatedArticles } from "@/lib/content/articles";
import { brand } from "@/config/brand";

/**
 * One article.
 *
 * Fully server-rendered, with semantic headings and a real `<time>`, because
 * this is the content search engines are meant to find. The body is rendered as
 * elements rather than injected as HTML - see `article-body.tsx` for why.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) return { title: "Article not found", robots: { index: false, follow: false } };

  const description = (article.seoDescription ?? article.excerpt).slice(0, 200);

  return {
    title: article.seoTitle ?? article.title,
    description,
    alternates: { canonical: `${brand.url}/articles/${article.slug}` },
    openGraph: {
      title: article.seoTitle ?? article.title,
      description,
      url: `${brand.url}/articles/${article.slug}`,
      type: "article",
      publishedTime: article.publishedAt.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      ...(article.coverImageUrl ? { images: [{ url: article.coverImageUrl }] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) notFound();

  const related = await relatedArticles({
    articleId: article.id,
    categorySlug: article.categorySlug,
  });

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <nav aria-label="Breadcrumb" className="mb-6">
          <Link className="caption text-foreground-muted underline transition hover:text-foreground" href="/articles">
            ← All articles
          </Link>
        </nav>

        <article className="mx-auto max-w-[var(--container-md)]">
          <header>
            {article.categoryName && article.categorySlug ? (
              <Link
                className="caption uppercase tracking-wider text-premium underline-offset-4 hover:underline"
                href={`/articles/category/${article.categorySlug}`}
              >
                {article.categoryName}
              </Link>
            ) : null}

            <h1 className="mt-2 heading-xl">{article.title}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 body-sm text-foreground-muted">
              {article.authorName ? <span>By {article.authorName}</span> : null}
              <time dateTime={article.publishedAt.toISOString()}>
                {article.publishedAt.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
              <span className="inline-flex items-center gap-1.5">
                <Clock aria-hidden="true" size={13} />
                {article.readingMinutes} min read
              </span>
            </div>
          </header>

          {article.coverImageUrl ? (
            <div className="mt-8 overflow-hidden rounded-lg border border-border">
              <Image
                alt=""
                className="aspect-[16/9] w-full object-cover"
                height={720}
                priority
                src={article.coverImageUrl}
                width={1280}
              />
            </div>
          ) : null}

          <div className="mt-8">
            <ArticleBody content={article.content} />
          </div>

          {article.tags.length > 0 ? (
            <footer className="mt-10 border-t border-border pt-6">
              <h2 className="sr-only">Tags</h2>
              <ul className="flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <li
                    className="rounded-md border border-border bg-surface px-3 py-1.5 caption text-foreground-secondary"
                    key={tag}
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </footer>
          ) : null}
        </article>

        {related.length > 0 ? (
          <section aria-labelledby="related-heading" className="mt-16">
            <h2 className="mb-6 heading-md" id="related-heading">
              Continue reading
            </h2>
            <ArticleGrid articles={related} />
          </section>
        ) : null}
      </PageContainer>
    </Section>
  );
}
