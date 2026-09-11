import "server-only";

import { AuditAction, ConsultationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/admin/audit";

/**
 * Scoped chart access for Pandits.
 *
 * The rule, stated once: a Pandit never has standing access to anybody's chart.
 * Access exists only as a row created by the *customer*, for a named
 * consultation, and it can be revoked. There is no query in the Pandit-facing
 * code that reads a chart without joining through this table, so "can this
 * Pandit see this chart?" has one answer in one place rather than being
 * re-decided at each screen.
 *
 * That is stricter than it needs to be for convenience and exactly as strict as
 * it needs to be for birth data, which is private customer data under the
 * product rules.
 */

export class KundliAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KundliAccessError";
  }
}

/**
 * A customer shares one of their saved charts with the Pandit they have booked.
 *
 * Both halves are checked against the acting customer: the consultation must be
 * theirs, and the chart must be theirs. Neither is taken on trust from the
 * form, so a crafted request cannot share a chart the sender does not own, nor
 * share it with a Pandit they have not booked.
 */
export async function grantKundliAccess(input: {
  customerUserId: string;
  consultationId: string;
  savedKundliId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return prisma.$transaction(async (tx) => {
    const consultation = await tx.consultation.findFirst({
      where: { id: input.consultationId, userId: input.customerUserId },
      select: { id: true, panditProfileId: true, status: true },
    });

    if (!consultation) return { ok: false as const, message: "That consultation could not be found." };

    if (
      consultation.status === ConsultationStatus.CANCELLED ||
      consultation.status === ConsultationStatus.NO_SHOW
    ) {
      return { ok: false as const, message: "That consultation is no longer active." };
    }

    const saved = await tx.savedKundli.findFirst({
      where: { id: input.savedKundliId, userId: input.customerUserId },
      select: { birthProfileId: true, calculationId: true },
    });

    if (!saved) return { ok: false as const, message: "That chart could not be found." };

    await tx.panditKundliAccess.upsert({
      where: {
        consultationId_calculationId: {
          consultationId: consultation.id,
          calculationId: saved.calculationId,
        },
      },
      // Re-sharing something previously revoked lifts the revocation rather
      // than failing, which is what the customer means by sharing it again.
      update: { revokedAt: null },
      create: {
        panditProfileId: consultation.panditProfileId,
        consultationId: consultation.id,
        birthProfileId: saved.birthProfileId,
        calculationId: saved.calculationId,
        grantedByUserId: input.customerUserId,
      },
    });

    await recordAudit(tx, {
      actorUserId: input.customerUserId,
      action: AuditAction.PANDIT_KUNDLI_ACCESS_GRANTED,
      entityType: "Consultation",
      entityId: consultation.id,
      // Ids only. No birth date, time or place ever enters the audit log.
      metadata: { panditProfileId: consultation.panditProfileId },
    });

    return { ok: true as const };
  });
}

/** The customer withdraws a share. Scoped to the granting customer. */
export async function revokeKundliAccess(input: {
  customerUserId: string;
  accessId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const access = await prisma.panditKundliAccess.findFirst({
    where: { id: input.accessId, grantedByUserId: input.customerUserId, revokedAt: null },
    select: { id: true, consultationId: true, panditProfileId: true },
  });

  if (!access) return { ok: false, message: "That share could not be found." };

  await prisma.$transaction(async (tx) => {
    await tx.panditKundliAccess.update({
      where: { id: access.id },
      data: { revokedAt: new Date() },
    });

    await recordAudit(tx, {
      actorUserId: input.customerUserId,
      action: AuditAction.PANDIT_KUNDLI_ACCESS_REVOKED,
      entityType: "Consultation",
      entityId: access.consultationId,
      metadata: { panditProfileId: access.panditProfileId },
    });
  });

  return { ok: true };
}

export type SharedChartSummary = {
  accessId: string;
  consultationId: string;
  consultationAt: Date;
  clientName: string;
  chartName: string;
  sharedAt: Date;
  lastViewedAt: Date | null;
};

/**
 * Charts currently shared with this Pandit.
 *
 * `revokedAt: null` and the expiry check are in the query, so a revoked share
 * is not something the page has to remember to filter out.
 */
export async function listSharedCharts(panditProfileId: string): Promise<SharedChartSummary[]> {
  const rows = await prisma.panditKundliAccess.findMany({
    where: {
      panditProfileId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      id: true,
      createdAt: true,
      lastViewedAt: true,
      consultationId: true,
      consultation: {
        select: { scheduledStart: true, user: { select: { name: true, email: true } } },
      },
      birthProfile: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    accessId: row.id,
    consultationId: row.consultationId,
    consultationAt: row.consultation.scheduledStart,
    clientName: row.consultation.user.name || row.consultation.user.email,
    chartName: row.birthProfile.name,
    sharedAt: row.createdAt,
    lastViewedAt: row.lastViewedAt,
  }));
}

export type SharedChart = {
  accessId: string;
  chartName: string;
  clientName: string;
  birthProfile: {
    name: string;
    dateOfBirth: Date;
    timeOfBirth: string;
    placeName: string;
    timezone: string;
  };
  calculation: { id: string; result: unknown; calculationType: string };
};

/**
 * Opens one shared chart.
 *
 * The access row is the join, not a filter applied afterwards: a Pandit who was
 * never granted this chart, or whose grant was revoked, gets null - the same
 * answer as for a chart that does not exist, so ids cannot be probed.
 *
 * Every open is recorded on the access row and in the audit log, because
 * reading somebody's birth data is exactly the kind of access that should leave
 * a trace the customer could be shown.
 */
export async function openSharedChart(input: {
  panditProfileId: string;
  panditUserId: string;
  accessId: string;
}): Promise<SharedChart | null> {
  const access = await prisma.panditKundliAccess.findFirst({
    where: {
      id: input.accessId,
      panditProfileId: input.panditProfileId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      id: true,
      consultationId: true,
      birthProfile: {
        select: {
          name: true,
          dateOfBirth: true,
          timeOfBirth: true,
          placeName: true,
          timezone: true,
        },
      },
      calculation: { select: { id: true, result: true, calculationType: true } },
      consultation: { select: { user: { select: { name: true, email: true } } } },
    },
  });

  if (!access) return null;

  await prisma.$transaction(async (tx) => {
    await tx.panditKundliAccess.update({
      where: { id: access.id },
      data: { lastViewedAt: new Date(), viewCount: { increment: 1 } },
    });

    await recordAudit(tx, {
      actorUserId: input.panditUserId,
      action: AuditAction.PANDIT_KUNDLI_ACCESSED,
      entityType: "Consultation",
      entityId: access.consultationId,
      // No birth details in the metadata; the ids are enough to reconstruct who
      // looked at what without copying private data into the log.
      metadata: { panditProfileId: input.panditProfileId, accessId: access.id },
    });
  });

  return {
    accessId: access.id,
    chartName: access.birthProfile.name,
    clientName: access.consultation.user.name || access.consultation.user.email,
    birthProfile: access.birthProfile,
    calculation: access.calculation,
  };
}
