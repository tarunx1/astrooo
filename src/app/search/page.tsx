import type { Metadata } from "next";
import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { PageContainer, Section, SectionHeader } from "@/components/layout/primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { SEARCH_TYPE_LABEL, search, type SearchResultType } from "@/lib/search/search";
import { cn } from "@/lib/utils";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Search",
  description: "Search across astrologers, pujas, reports, free tools, guides and the store.",
  alternates: { canonical: `${brand.url}/search` },
  // A results page is not itself content worth indexing, and indexing arbitrary
  // query strings creates exactly the thin pages the content rules forbid.
  robots: { index: false, follow: true },
};

const TYPES: readonly SearchResultType[] = [
  "pandit",
  "article",
  "calculator",
  "report",
  "puja",
  "gemstone",
  "product",
];

/**
 * Site search.
 *
 * Server-rendered from the query string, so a search is a linkable page and the
 * back button behaves. Results are grouped by type, and every query sees only
 * what the public sees - drafts, inactive products and unapproved
 * practitioners are absent by construction.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; type?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;

  const query = (rawQuery ?? "").trim();
  const type = TYPES.includes(rawType as SearchResultType) ? (rawType as SearchResultType) : undefined;

  const response = query.length >= 2 ? await search({ query, type }) : null;

  const hrefFor = (nextType: SearchResultType | undefined) => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (nextType) next.set("type", nextType);
    return `/search?${next.toString()}`;
  };

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <SectionHeader
          text="Look across astrologers, pujas, reports, free tools, guides and the store at once."
          title="Search"
        />

        <form action="/search" className="flex flex-wrap gap-2" method="get">
          <div className="relative min-w-0 flex-1">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted"
              size={17}
            />
            <label className="sr-only" htmlFor="site-search">
              Search Tarun Astro
            </label>
            <input
              autoComplete="off"
              className="form-control min-h-12 w-full pl-11"
              defaultValue={query}
              id="site-search"
              name="q"
              placeholder="Try 'Mars', 'sapphire', 'marriage' or 'Rudrabhishek'"
              type="search"
            />
          </div>
          <button
            className="min-h-12 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
            type="submit"
          >
            Search
          </button>
        </form>

        {response === null ? (
          <p className="mt-8 body-sm text-foreground-muted">
            {query.length === 0
              ? "Enter something to search for."
              : "Type at least two characters to search."}
          </p>
        ) : (
          <>
            <nav aria-label="Filter by type" className="mt-8">
              <ul className="flex flex-wrap gap-2">
                <li>
                  <Link
                    aria-current={type === undefined ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 caption font-semibold transition",
                      type === undefined
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-foreground-secondary hover:border-border-strong",
                    )}
                    href={hrefFor(undefined)}
                  >
                    Everything
                    <span className="text-foreground-muted">{response.total}</span>
                  </Link>
                </li>
                {TYPES.filter((candidate) => (response.countsByType[candidate] ?? 0) > 0 || type === candidate).map(
                  (candidate) => (
                    <li key={candidate}>
                      <Link
                        aria-current={type === candidate ? "page" : undefined}
                        className={cn(
                          "inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 caption font-semibold transition",
                          type === candidate
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-foreground-secondary hover:border-border-strong",
                        )}
                        href={hrefFor(candidate)}
                      >
                        {SEARCH_TYPE_LABEL[candidate]}
                        <span className="text-foreground-muted">
                          {response.countsByType[candidate] ?? 0}
                        </span>
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </nav>

            <div aria-live="polite" className="mt-8">
              <p className="mb-5 body-sm text-foreground-muted">
                {response.total === 0
                  ? `Nothing found for “${response.query}”`
                  : `${response.total} result${response.total === 1 ? "" : "s"} for “${response.query}”`}
              </p>

              {response.results.length === 0 ? (
                <EmptyState
                  message="Try a different word, or browse the astrologers, guides and store directly."
                  title="No results"
                />
              ) : (
                <ul className="grid gap-3">
                  {response.results.map((result) => (
                    <li key={result.id}>
                      <Card className="p-0" variant="interactive">
                        <Link
                          className="block p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                          href={result.href}
                          prefetch={false}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
                              {SEARCH_TYPE_LABEL[result.type]}
                            </span>
                            {result.badge ? (
                              <span className="caption text-premium">{result.badge}</span>
                            ) : null}
                          </div>
                          <h2 className="mt-2 heading-sm text-foreground">{result.title}</h2>
                          <p className="mt-1 line-clamp-2 body-sm text-foreground-secondary">
                            {result.description}
                          </p>
                        </Link>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </PageContainer>
    </Section>
  );
}
