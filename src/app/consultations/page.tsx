import type { Metadata } from "next";
import Link from "next/link";
import { ConsultationMode } from "@prisma/client";
import { PageContainer, Section, SectionHeader } from "@/components/layout/primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { DirectoryFilters } from "@/components/consultations/directory-filters";
import { PanditGrid } from "@/components/consultations/pandit-card";
import { DIRECTORY_PAGE_SIZE, directoryFacets, listDirectory } from "@/lib/consultations/directory";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Consult a Verified Astrologer | Chat, Voice & Video",
  description:
    "Book a consultation with a verified Vedic or KP astrologer. Compare specialisations, languages and rates, then pick a time that suits you.",
  alternates: { canonical: `${brand.url}/consultations` },
  openGraph: {
    title: "Consult a Verified Astrologer",
    description:
      "Verified practitioners for Kundli, marriage, career and remedial guidance. Chat, voice and video consultations.",
    url: `${brand.url}/consultations`,
    type: "website",
  },
};

/**
 * The public practitioner directory.
 *
 * Server-rendered, with filters carried in the URL so a filtered view is a real
 * page that can be shared, bookmarked and indexed. Filtering and pagination
 * happen in the database: loading every practitioner to filter them in the
 * browser would get slower with each Pandit who joins.
 */
function readParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() || undefined;
}

export default async function ConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const q = readParam(params.q);
  const language = readParam(params.language);
  const expertise = readParam(params.expertise);
  const modeRaw = readParam(params.mode);
  const maxRateRaw = readParam(params.maxRate);
  const available = readParam(params.available);
  const page = Math.max(1, Number(readParam(params.page) ?? 1) || 1);

  const mode =
    modeRaw && modeRaw in ConsultationMode ? (modeRaw as ConsultationMode) : undefined;

  const parsedRate = maxRateRaw ? Number(maxRateRaw) : Number.NaN;
  const maxRatePaise = Number.isFinite(parsedRate) && parsedRate > 0 ? Math.trunc(parsedRate) : undefined;

  const [facets, result] = await Promise.all([
    directoryFacets(),
    listDirectory({
      q,
      language,
      expertise,
      mode,
      maxRatePaise,
      availableOnly: available === "1",
      page,
      pageSize: DIRECTORY_PAGE_SIZE,
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));

  const hrefForPage = (target: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (language) next.set("language", language);
    if (expertise) next.set("expertise", expertise);
    if (mode) next.set("mode", mode);
    if (maxRatePaise) next.set("maxRate", String(maxRatePaise));
    if (available === "1") next.set("available", "1");
    if (target > 1) next.set("page", String(target));
    const query = next.toString();
    return query ? `/consultations?${query}` : "/consultations";
  };

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <SectionHeader
          text="Every practitioner here has been verified before being listed. Compare specialisations, languages and rates, then book a time that works for you."
          title="Consult an Astrologer"
        />

        <DirectoryFilters
          current={{ q, language, expertise, mode: modeRaw, maxRate: maxRateRaw, available }}
          facets={facets}
        />

        <div aria-live="polite" className="mt-8">
          <p className="mb-5 body-sm text-foreground-muted">
            {result.total === 0
              ? "No practitioners match these filters"
              : `${result.total} practitioner${result.total === 1 ? "" : "s"} available`}
          </p>

          {result.rows.length === 0 ? (
            <EmptyState
              message={
                result.total === 0
                  ? "Try widening your filters, or clear them to see everyone currently taking bookings."
                  : "No practitioners on this page match the rating you selected."
              }
              title="Nothing to show"
            />
          ) : (
            <PanditGrid pandits={result.rows} />
          )}
        </div>

        {pageCount > 1 ? (
          <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-3">
            <p className="caption text-foreground-muted">
              Page {result.page} of {pageCount}
            </p>
            <div className="flex gap-2">
              {result.page > 1 ? (
                <Link
                  className="inline-flex min-h-10 items-center rounded-md border border-border px-4 body-sm font-semibold text-foreground-secondary transition hover:border-border-strong hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                  href={hrefForPage(result.page - 1)}
                  prefetch={false}
                  rel="prev"
                >
                  Previous
                </Link>
              ) : null}
              {result.page < pageCount ? (
                <Link
                  className="inline-flex min-h-10 items-center rounded-md border border-border px-4 body-sm font-semibold text-foreground-secondary transition hover:border-border-strong hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                  href={hrefForPage(result.page + 1)}
                  prefetch={false}
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
