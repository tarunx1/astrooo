import "server-only";

import { PanditOnboardingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { REVIEW_QUEUE_STATUSES } from "@/lib/pandit/onboarding";

/**
 * Reviewer-facing reads.
 *
 * Everything here is paginated and selects explicit columns. A reviewer needs
 * the case file in front of them - who applied, what they claim, what they
 * uploaded, who decided what - and nothing about the applicant's customer
 * account, orders or charts, so none of that is in any select list.
 */

export type PanditListRow = {
  id: string;
  displayName: string;
  email: string;
  status: PanditOnboardingStatus;
  city: string | null;
  state: string | null;
  yearsOfExperience: number | null;
  expertise: string[];
  languages: string[];
  documentCount: number;
  submittedAt: Date | null;
  createdAt: Date;
};

export async function listPandits(input: {
  page: number;
  pageSize: number;
  status?: PanditOnboardingStatus;
  /** Restricts to the states a reviewer acts on. */
  queueOnly?: boolean;
  search?: string;
  expertise?: string;
  city?: string;
}): Promise<{ rows: PanditListRow[]; total: number }> {
  const where: Prisma.PanditProfileWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.queueOnly && !input.status ? { status: { in: [...REVIEW_QUEUE_STATUSES] } } : {}),
    ...(input.expertise ? { expertise: { has: input.expertise } } : {}),
    ...(input.city ? { city: { equals: input.city, mode: "insensitive" } } : {}),
    ...(input.search
      ? {
          OR: [
            { displayName: { contains: input.search, mode: "insensitive" } },
            { user: { email: { contains: input.search, mode: "insensitive" } } },
            { user: { name: { contains: input.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.panditProfile.findMany({
      where,
      select: {
        id: true,
        displayName: true,
        status: true,
        city: true,
        state: true,
        yearsOfExperience: true,
        expertise: true,
        languages: true,
        submittedAt: true,
        createdAt: true,
        user: { select: { email: true } },
        _count: { select: { documents: true } },
      },
      // Applications waiting longest are dealt with first; a queue ordered by
      // newest would quietly starve the people who have waited most.
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.panditProfile.count({ where }),
  ]);

  return {
    total,
    rows: rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      email: row.user.email,
      status: row.status,
      city: row.city,
      state: row.state,
      yearsOfExperience: row.yearsOfExperience,
      expertise: row.expertise,
      languages: row.languages,
      documentCount: row._count.documents,
      submittedAt: row.submittedAt,
      createdAt: row.createdAt,
    })),
  };
}

const detailSelect = {
  id: true,
  userId: true,
  status: true,
  displayName: true,
  slug: true,
  headline: true,
  bio: true,
  profileImageUrl: true,
  phone: true,
  city: true,
  state: true,
  country: true,
  timezone: true,
  yearsOfExperience: true,
  languages: true,
  expertise: true,
  certifications: true,
  commissionPercent: true,
  submittedAt: true,
  reviewStartedAt: true,
  changesRequestedAt: true,
  changeRequestNote: true,
  verifiedAt: true,
  approvedAt: true,
  activatedAt: true,
  rejectedAt: true,
  rejectionReason: true,
  suspendedAt: true,
  suspensionReason: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, createdAt: true } },
  documents: {
    select: {
      id: true,
      type: true,
      status: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      note: true,
      rejectionReason: true,
      reviewedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  },
  reviewTrail: {
    select: {
      id: true,
      decision: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      createdAt: true,
      reviewer: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  },
  services: {
    select: { id: true, mode: true, enabled: true, rateType: true, ratePaise: true, sessionMinutes: true },
  },
  _count: { select: { consultations: true } },
} satisfies Prisma.PanditProfileSelect;

export type PanditDetail = Prisma.PanditProfileGetPayload<{ select: typeof detailSelect }>;

/**
 * The full case file for one application.
 *
 * `storageKey` is absent from the document select: a reviewer opens a document
 * through the authorized route, and the key has no business travelling to a
 * browser.
 */
export async function getPanditDetail(panditProfileId: string): Promise<PanditDetail | null> {
  return prisma.panditProfile.findUnique({ where: { id: panditProfileId }, select: detailSelect });
}

/** Queue depth by status, for dashboard tiles. Counted, never estimated. */
export async function panditStatusCounts(): Promise<Record<PanditOnboardingStatus, number>> {
  const rows = await prisma.panditProfile.groupBy({ by: ["status"], _count: { _all: true } });

  const counts = Object.fromEntries(
    Object.values(PanditOnboardingStatus).map((status) => [status, 0]),
  ) as Record<PanditOnboardingStatus, number>;

  for (const row of rows) counts[row.status] = row._count._all;
  return counts;
}

/**
 * Publicly listable Pandits.
 *
 * ACTIVE and nothing else. The status check is in the query rather than applied
 * after fetching, so an unapproved profile is not something the page has to
 * remember to filter out.
 */
export async function listPublicPandits(input: {
  page: number;
  pageSize: number;
  expertise?: string;
  language?: string;
}) {
  const where: Prisma.PanditProfileWhereInput = {
    status: PanditOnboardingStatus.ACTIVE,
    ...(input.expertise ? { expertise: { has: input.expertise } } : {}),
    ...(input.language ? { languages: { has: input.language } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.panditProfile.findMany({
      where,
      // Bank details, documents, review notes and the owning user id are not in
      // this select, so no shape of public rendering can reach them.
      select: {
        id: true,
        slug: true,
        displayName: true,
        headline: true,
        bio: true,
        profileImageUrl: true,
        city: true,
        yearsOfExperience: true,
        languages: true,
        expertise: true,
        services: {
          where: { enabled: true },
          select: { mode: true, rateType: true, ratePaise: true, sessionMinutes: true },
        },
      },
      orderBy: { activatedAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.panditProfile.count({ where }),
  ]);

  return { rows, total };
}

/**
 * A Pandit's client list.
 *
 * Derived from consultations rather than from the user table: someone appears
 * here because they booked this Pandit, and there is no query shape that
 * returns a customer who did not.
 */
export async function listPanditClients(panditProfileId: string) {
  const consultations = await prisma.consultation.findMany({
    where: { panditProfileId },
    select: {
      userId: true,
      scheduledStart: true,
      status: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { scheduledStart: "desc" },
  });

  const byUser = new Map<
    string,
    { id: string; name: string; email: string; consultationCount: number; lastAt: Date }
  >();

  for (const consultation of consultations) {
    const existing = byUser.get(consultation.userId);
    if (existing) {
      existing.consultationCount += 1;
      continue;
    }
    byUser.set(consultation.userId, {
      id: consultation.user.id,
      name: consultation.user.name,
      email: consultation.user.email,
      consultationCount: 1,
      lastAt: consultation.scheduledStart,
    });
  }

  return [...byUser.values()];
}
