import "server-only";

import { AuditAction, ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/admin/audit";
import { MAX_GENERATION_ATTEMPTS } from "@/lib/reports/generation";

/**
 * Report generation retry.
 *
 * Re-queues an existing GeneratedReport rather than creating a new one, so the
 * original ReportOrder, its price snapshot and its immutable
 * AstrologyCalculation are all preserved and the customer is never charged
 * again. Attempt history is kept: `attemptCount` is not reset, only the failure
 * state is cleared so a worker can pick the job up.
 */
export type RetryOutcome =
  | { ok: true; generatedReportId: string }
  | { ok: false; reason: "not_found" | "not_failed" | "already_ready" | "exhausted"; message: string };

export async function retryGeneratedReport(input: {
  adminUserId: string;
  generatedReportId: string;
}): Promise<RetryOutcome> {
  return prisma.$transaction(async (tx) => {
    const report = await tx.generatedReport.findUnique({
      where: { id: input.generatedReportId },
      select: {
        id: true,
        status: true,
        attemptCount: true,
        storageKey: true,
        reportOrderId: true,
        reportOrder: { select: { id: true, status: true } },
      },
    });

    if (!report) {
      return { ok: false as const, reason: "not_found" as const, message: "That report could not be found." };
    }

    // A finished report is never regenerated: the artefact already exists and
    // re-running would burn a paid model call for no benefit.
    if (report.status === ReportStatus.READY && report.storageKey) {
      return {
        ok: false as const,
        reason: "already_ready" as const,
        message: "This report is already delivered. There is nothing to retry.",
      };
    }

    if (report.status !== ReportStatus.FAILED) {
      return {
        ok: false as const,
        reason: "not_failed" as const,
        message: "Only a failed report can be retried.",
      };
    }

    if (report.attemptCount >= MAX_GENERATION_ATTEMPTS) {
      // The automatic budget is spent; an operator retry grants one more, which
      // is why attemptCount is decremented by nothing and the cap is checked here.
      return {
        ok: false as const,
        reason: "exhausted" as const,
        message: `This report has already used its ${MAX_GENERATION_ATTEMPTS} automatic attempts. Investigate the cause before retrying.`,
      };
    }

    await tx.generatedReport.update({
      where: { id: report.id },
      data: {
        status: ReportStatus.QUEUED,
        lastError: null,
        lastErrorCategory: null,
        lastErrorAt: null,
      },
    });

    // The order returns to PAID: generation state lives on the report, and the
    // payment fact is untouched.
    await tx.reportOrder.updateMany({
      where: { id: report.reportOrderId, status: ReportStatus.FAILED },
      data: { status: ReportStatus.PAID },
    });

    await recordAudit(tx, {
      actorUserId: input.adminUserId,
      action: AuditAction.REPORT_GENERATION_RETRIED,
      entityType: "GeneratedReport",
      entityId: report.id,
      metadata: { reportOrderId: report.reportOrderId, attemptCount: report.attemptCount },
    });

    return { ok: true as const, generatedReportId: report.id };
  });
}
