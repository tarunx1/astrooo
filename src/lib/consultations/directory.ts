import "server-only";

import { ConsultationMode, PanditOnboardingStatus, Prisma, RateType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isBookable } from "@/lib/pandit/onboarding";

/**
 * The public practitioner directory.
 *
 * One rule governs every read here: a Pandit is listed only when
 * `status = ACTIVE` and a public slug has been minted. Both conditions are in
 * the `where` clause rather than applied after fetching, so an unapproved or
 * suspended profile is not something a page has to remember to filter out - it
 * is not in the result set to begin with.
 *
 * Nothing in these selects can reach a document, a bank detail, a review note
 * or the owning user's email. That is enforced by the select lists being
 * explicit: a field that is never selected cannot leak through a component
 * that forgot to omit it.
 */

/** The only condition under which someone appears publicly. */
const PUBLIC_WHERE = {
  status: PanditOnboardingStatus.ACTIVE,
  slug: { not: null },
} satisfies Prisma.PanditProfileWhereInput;

export type DirectoryFilters = {
  q?: string;
  language?: string;
  expertise?: string;
  mode?: ConsultationMode;
  maxRatePaise?: number;
  minRating?: number;
  availableOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export type DirectoryPandit = {
  id: string;
  slug: string;
  displayName: string;
  headline: string | null;
  profileImageUrl: string | null;
  city: string | null;
  yearsOfExperience: number | null;
  languages: string[];
  expertise: string[];
  /** Null when nobody has reviewed them yet. Never a fabricated default. */
  rating: number | null;
  reviewCount: number;
  services: Array<{
    mode: ConsultationMode;
    rateType: RateType;
    ratePaise: number;
    sessionMinutes: number | null;
  }>;
  /** True when they have at least one weekly availability window. */
  hasAvailability: boolean;
  /** Every ACTIVE Pandit has passed verification; carried for the badge. */
  verified: boolean;
};

const CARD_SELECT = {
  id: true,
  slug: true,
  displayName: true,
  headline: true,
  profileImageUrl: true,
  city: true,
  yearsOfExperience: true,
  languages: true,
  expertise: true,
  activatedAt: true,
  services: {
    where: { enabled: true },
    select: { mode: true, rateType: true, ratePaise: true, sessionMinutes: true },
  },
  _count: { select: { scheduleRules: true } },
} satisfies Prisma.PanditProfileSelect;

type CardRow = Prisma.PanditProfileGetPayload<{ select: typeof CARD_SELECT }>;

/**
 * Published review aggregates for a set of Pandits.
 *
 * Only `published` reviews count. An unpublished review is a draft or one an
 * operator has withheld, and including it would let an unmoderated rating move
 * a public average.
 *
 * Returns nothing at all for a Pandit with no reviews rather than a zero, so
 * the caller can render "new" instead of a misleading 0.0.
 */
async function publishedRatings(
  panditProfileIds: readonly string[],
): Promise<Map<string, { rating: number; count: number }>> {
  if (panditProfileIds.length === 0) return new Map();

  const rows = await prisma.review.groupBy({
    by: ["panditProfileId"],
    where: { panditProfileId: { in: [...panditProfileIds] }, published: true },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const map = new Map<string, { rating: number; count: number }>();

  for (const row of rows) {
    if (!row.panditProfileId || row._avg.rating === null || row._count._all === 0) continue;
    map.set(row.panditProfileId, {
      rating: Math.round(row._avg.rating * 10) / 10,
      count: row._count._all,
    });
  }

  return map;
}

function toCard(row: CardRow, rating: { rating: number; count: number } | undefined): DirectoryPandit {
  return {
    id: row.id,
    // Non-null by the query: PUBLIC_WHERE requires a slug.
    slug: row.slug!,
    displayName: row.displayName,
    headline: row.headline,
    profileImageUrl: row.profileImageUrl,
    city: row.city,
    yearsOfExperience: row.yearsOfExperience,
    languages: row.languages,
    expertise: row.expertise,
    rating: rating?.rating ?? null,
    reviewCount: rating?.count ?? 0,
    services: row.services,
    hasAvailability: row._count.scheduleRules > 0,
    verified: true,
  };
}

export const DIRECTORY_PAGE_SIZE = 12;

/**
 * Lists practitioners for the directory.
 *
 * Filtering and pagination are done in the database, not in the page: loading
 * every practitioner to filter them in a component would get slower with every
 * Pandit who joins, and would send the full list to the browser regardless of
 * what was asked for.
 *
 * Rating is the one filter that cannot be expressed in the same query, because
 * it is an aggregate over a different table. It is applied after the page is
 * fetched and is documented as such on the filter control, rather than
 * silently returning short pages.
 */
export async function listDirectory(filters: DirectoryFilters): Promise<{
  rows: DirectoryPandit[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, filters.pageSize ?? DIRECTORY_PAGE_SIZE));
  const search = filters.q?.trim();

  const where: Prisma.PanditProfileWhereInput = {
    ...PUBLIC_WHERE,
    ...(filters.language ? { languages: { has: filters.language } } : {}),
    ...(filters.expertise ? { expertise: { has: filters.expertise } } : {}),
    ...(filters.availableOnly ? { scheduleRules: { some: {} } } : {}),
    ...(filters.mode || filters.maxRatePaise !== undefined
      ? {
          services: {
            some: {
              enabled: true,
              ...(filters.mode ? { mode: filters.mode } : {}),
              ...(filters.maxRatePaise !== undefined
                ? { ratePaise: { lte: filters.maxRatePaise } }
                : {}),
            },
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { displayName: { contains: search, mode: "insensitive" } },
            { headline: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
            // Array columns match a whole element, so a partial word will not
            // hit these. The name and headline searches cover partials.
            { expertise: { has: search } },
            { languages: { has: search } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.panditProfile.findMany({
      where,
      select: CARD_SELECT,
      // Longest-serving first is a defensible default that does not depend on
      // ratings, which most practitioners will not have at launch.
      orderBy: [{ yearsOfExperience: "desc" }, { activatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.panditProfile.count({ where }),
  ]);

  const ratings = await publishedRatings(rows.map((row) => row.id));
  let cards = rows.map((row) => toCard(row, ratings.get(row.id)));

  if (filters.minRating !== undefined) {
    cards = cards.filter((card) => card.rating !== null && card.rating >= filters.minRating!);
  }

  return { rows: cards, total, page, pageSize };
}

/**
 * Facets for the filter controls.
 *
 * Derived from the practitioners who are actually listed, so a filter is never
 * offered that would return nothing. Computed from the same public predicate,
 * which means a suspended Pandit's languages disappear from the filter along
 * with their profile.
 */
export async function directoryFacets(): Promise<{
  languages: string[];
  expertise: string[];
  modes: ConsultationMode[];
  maxRatePaise: number | null;
}> {
  const rows = await prisma.panditProfile.findMany({
    where: PUBLIC_WHERE,
    select: {
      languages: true,
      expertise: true,
      services: { where: { enabled: true }, select: { mode: true, ratePaise: true } },
    },
  });

  const languages = new Set<string>();
  const expertise = new Set<string>();
  const modes = new Set<ConsultationMode>();
  let maxRate = 0;

  for (const row of rows) {
    for (const language of row.languages) languages.add(language);
    for (const item of row.expertise) expertise.add(item);
    for (const service of row.services) {
      modes.add(service.mode);
      if (service.ratePaise > maxRate) maxRate = service.ratePaise;
    }
  }

  return {
    languages: [...languages].sort(),
    expertise: [...expertise].sort(),
    modes: [...modes],
    maxRatePaise: maxRate > 0 ? maxRate : null,
  };
}

export type PublicPanditProfile = DirectoryPandit & {
  bio: string | null;
  state: string | null;
  country: string;
  timezone: string;
  certifications: string[];
  activatedAt: Date | null;
  reviews: Array<{
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    authorName: string;
    createdAt: Date;
  }>;
};

/**
 * One public profile, by slug.
 *
 * Returns null for a Pandit who is not currently listed - including one who was
 * listed yesterday and is suspended today - so a bookmarked URL stops working
 * the moment it should, rather than continuing to show a profile that can no
 * longer be booked.
 *
 * The select list is the privacy control: documents, payout account, review
 * notes, commission and the owning user's email are absent, so there is no
 * shape of rendering that exposes them.
 */
export async function getPublicPandit(slug: string): Promise<PublicPanditProfile | null> {
  const row = await prisma.panditProfile.findFirst({
    where: { ...PUBLIC_WHERE, slug },
    select: {
      ...CARD_SELECT,
      bio: true,
      state: true,
      country: true,
      timezone: true,
      certifications: true,
      reviews: {
        where: { published: true },
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          createdAt: true,
          // A first name only. A reviewer is a customer, and their full
          // identity is not part of the review.
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!row) return null;

  const ratings = await publishedRatings([row.id]);

  return {
    ...toCard(row, ratings.get(row.id)),
    bio: row.bio,
    state: row.state,
    country: row.country,
    timezone: row.timezone,
    certifications: row.certifications,
    activatedAt: row.activatedAt,
    reviews: row.reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      authorName: review.user.name.split(" ")[0] || "Customer",
      createdAt: review.createdAt,
    })),
  };
}

/**
 * Resolves a listed Pandit by slug for a booking flow.
 *
 * Deliberately re-checks bookability rather than trusting that the page which
 * rendered the form had already done so.
 */
export async function getBookablePandit(slug: string): Promise<{
  id: string;
  displayName: string;
  timezone: string;
  services: Array<{ mode: ConsultationMode; rateType: RateType; ratePaise: number; sessionMinutes: number | null }>;
} | null> {
  const row = await prisma.panditProfile.findFirst({
    where: { slug },
    select: {
      id: true,
      status: true,
      displayName: true,
      timezone: true,
      services: {
        where: { enabled: true },
        select: { mode: true, rateType: true, ratePaise: true, sessionMinutes: true },
      },
    },
  });

  if (!row || !isBookable(row.status)) return null;

  return {
    id: row.id,
    displayName: row.displayName,
    timezone: row.timezone,
    services: row.services,
  };
}
