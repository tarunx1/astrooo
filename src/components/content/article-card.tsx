import { ContentImage } from "@/components/ui/content-image";
import Link from "next/link";
import { BookOpen, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { ArticleCardData } from "@/lib/content/articles";

/** A single article, in a listing. */
export function ArticleCard({ article }: { article: ArticleCardData }) {
  return (
    <Card className="group h-full overflow-hidden" variant="interactive">
      <Link
        className="flex h-full flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
        href={`/articles/${article.slug}`}
        prefetch={false}
      >
        <div className="relative aspect-[16/9] overflow-hidden bg-surface-raised">
          {article.coverImageUrl ? (
            <ContentImage
              alt=""
              className="size-full object-cover transition duration-[var(--motion-normal)] group-hover:scale-105"
              height={360}
              src={article.coverImageUrl}
              width={640}
            />
          ) : (
            <div aria-hidden="true" className="grid size-full place-items-center text-foreground-muted">
              <BookOpen size={26} />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          {article.categoryName ? (
            <p className="caption uppercase tracking-wider text-premium">{article.categoryName}</p>
          ) : null}

          <h2 className="mt-1.5 heading-sm text-foreground">{article.title}</h2>
          <p className="mt-2 line-clamp-2 body-sm text-foreground-secondary">{article.excerpt}</p>

          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 caption text-foreground-muted">
            <time dateTime={article.publishedAt.toISOString()}>
              {article.publishedAt.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </time>
            <span className="inline-flex items-center gap-1.5">
              <Clock aria-hidden="true" size={12} />
              {article.readingMinutes} min read
            </span>
          </div>
        </div>
      </Link>
    </Card>
  );
}

export function ArticleGrid({ articles }: { articles: readonly ArticleCardData[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <li className="h-full" key={article.id}>
          <ArticleCard article={article} />
        </li>
      ))}
    </ul>
  );
}
