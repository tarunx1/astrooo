import "server-only";

import { ReportStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  getInterpretationProvider,
  isAiInterpretationError,
  type AIInterpretationProvider,
  type AiErrorCategory,
} from "@/lib/ai/interpretation";
import { buildCalculatedFacts, buildReportContext } from "@/lib/reports/context";
import { REPORT_SCHEMA_VERSION, STANDARD_DISCLAIMERS, reportDocumentSchema } from "@/lib/reports/document";
import { PROMPT_VERSION, buildSystemPrompt, buildUserPrompt, getReportSpec, hasRequiredContext } from "@/lib/reports/specs";
import type { KundliResult } from "@/lib/kundli/types";

/**
 * Report generation pipeline.
 *
 *   PAID -> QUEUED -> INTERPRETING -> (RENDERING) -> READY
 *
 * A paid order is required before anything runs. The interpretation step is a
 * long model call, so it is never performed inside a customer request: callers
 * enqueue, and a worker drains the queue.
 */
export const MAX_GENERATION_ATTEMPTS = 3;

export type GenerationOutcome =
  | { ok: true; generatedReportId: string; alreadyComplete: boolean }
  | { ok: false; reason: "not_found" | "not_paid" | "insufficient_data" | "exhausted" | "failed"; message?: string };

/**
 * Marks a paid order ready for generation.
 *
 * Idempotent: an order already queued, interpreting or complete is left alone,
 * so a duplicate webhook or a double click cannot start two generations.
 */
export async function enqueueReportGeneration(reportOrderId: string): Promise<GenerationOutcome> {
  const order = await prisma.reportOrder.findUnique({
    where: { id: reportOrderId },
    select: { id: true, status: true, astrologyCalculationId: true, generatedReport: { select: { id: true, status: true } } },
  });

  if (!order) return { ok: false, reason: "not_found" };

  // Only a paid order may enter the pipeline.
  if (order.status !== ReportStatus.PAID && order.status !== ReportStatus.QUEUED) {
    const alreadyRunning =
      order.status === ReportStatus.INTERPRETING ||
      order.status === ReportStatus.RENDERING ||
      order.status === ReportStatus.READY;

    if (!alreadyRunning) return { ok: false, reason: "not_paid" };
  }

  if (order.generatedReport) {
    return { ok: true, generatedReportId: order.generatedReport.id, alreadyComplete: order.generatedReport.status === ReportStatus.READY };
  }

  const created = await prisma.generatedReport.create({
    data: { reportOrderId: order.id, status: ReportStatus.QUEUED },
    select: { id: true },
  });

  await prisma.reportOrder.update({
    where: { id: order.id },
    data: { status: ReportStatus.QUEUED },
  });

  return { ok: true, generatedReportId: created.id, alreadyComplete: false };
}

/** Claims the next queued job. Returns null when the queue is empty. */
export async function claimNextGenerationJob(): Promise<string | null> {
  const next = await prisma.generatedReport.findFirst({
    where: {
      status: ReportStatus.QUEUED,
      attemptCount: { lt: MAX_GENERATION_ATTEMPTS },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!next) return null;

  // Guarded transition: only one worker can move a job out of QUEUED.
  const claimed = await prisma.generatedReport.updateMany({
    where: { id: next.id, status: ReportStatus.QUEUED },
    data: { status: ReportStatus.INTERPRETING, attemptCount: { increment: 1 } },
  });

  return claimed.count === 1 ? next.id : null;
}

async function recordFailure(
  generatedReportId: string,
  reportOrderId: string,
  category: AiErrorCategory,
  message: string,
): Promise<void> {
  const current = await prisma.generatedReport.findUnique({
    where: { id: generatedReportId },
    select: { attemptCount: true },
  });

  // Invalid output will not fix itself on retry; transient failures might.
  const retryable = category === "transient" && (current?.attemptCount ?? 0) < MAX_GENERATION_ATTEMPTS;

  await prisma.generatedReport.update({
    where: { id: generatedReportId },
    data: {
      status: retryable ? ReportStatus.QUEUED : ReportStatus.FAILED,
      lastErrorCategory: category,
      lastError: message.slice(0, 500),
      lastErrorAt: new Date(),
    },
  });

  if (!retryable) {
    await prisma.reportOrder.update({ where: { id: reportOrderId }, data: { status: ReportStatus.FAILED } });
  }

  console.error("report_generation_failed", { generatedReportId, category, retryable });
}

/**
 * Runs interpretation for one claimed job.
 *
 * The model is handed an already-calculated chart. It authors narrative only:
 * facts and metadata are assembled here from the immutable calculation, so a
 * model can never introduce a planetary position into the finished document.
 */
export async function runGenerationJob(
  generatedReportId: string,
  provider?: AIInterpretationProvider,
): Promise<GenerationOutcome> {
  const job = await prisma.generatedReport.findUnique({
    where: { id: generatedReportId },
    select: {
      id: true,
      status: true,
      attemptCount: true,
      reportOrder: {
        select: {
          id: true,
          status: true,
          reportSlugSnapshot: true,
          astrologyCalculationId: true,
          astrologyCalculation: { select: { id: true, result: true, calculationVersion: true, ayanamsa: true, houseSystem: true } },
        },
      },
    },
  });

  if (!job) return { ok: false, reason: "not_found" };

  const order = job.reportOrder;

  if (order.status === ReportStatus.PENDING_PAYMENT) {
    return { ok: false, reason: "not_paid" };
  }

  if (job.attemptCount > MAX_GENERATION_ATTEMPTS) {
    await recordFailure(job.id, order.id, "unknown", "Maximum generation attempts exceeded.");
    return { ok: false, reason: "exhausted" };
  }

  const calculation = order.astrologyCalculation;
  if (!calculation?.result) {
    await recordFailure(job.id, order.id, "configuration", "No astrology calculation is attached to this order.");
    return { ok: false, reason: "insufficient_data" };
  }

  const spec = getReportSpec(order.reportSlugSnapshot);
  if (!spec) {
    await recordFailure(job.id, order.id, "configuration", `No prompt specification for "${order.reportSlugSnapshot}".`);
    return { ok: false, reason: "insufficient_data" };
  }

  const context = buildReportContext(calculation.result as unknown as KundliResult);
  if (!hasRequiredContext(spec, context)) {
    await recordFailure(job.id, order.id, "configuration", "The calculation is missing data this report requires.");
    return { ok: false, reason: "insufficient_data" };
  }

  const interpreter = provider ?? getInterpretationProvider();

  try {
    const { body, model, provider: providerName } = await interpreter.generateReportBody({
      systemPrompt: buildSystemPrompt(spec),
      userPrompt: buildUserPrompt(spec, context),
    });

    const generatedAt = new Date();

    // Facts and metadata are assembled from the calculation, not the model.
    const document = reportDocumentSchema.parse({
      schemaVersion: REPORT_SCHEMA_VERSION,
      reportType: spec.reportType,
      metadata: {
        subjectName: context.subjectName,
        generatedAt: generatedAt.toISOString(),
        astrologyCalculationId: calculation.id,
        calculationVersion: calculation.calculationVersion,
        ayanamsa: calculation.ayanamsa ?? context.ayanamsa,
        houseSystem: calculation.houseSystem ?? context.houseSystem,
        aiProvider: providerName,
        aiModel: model,
        promptVersion: PROMPT_VERSION,
      },
      title: body.title,
      introduction: body.introduction,
      calculatedFacts: buildCalculatedFacts(context),
      sections: body.sections,
      summary: body.summary,
      disclaimers: [...STANDARD_DISCLAIMERS],
    });

    await prisma.$transaction([
      prisma.generatedReport.update({
        where: { id: job.id },
        data: {
          status: ReportStatus.RENDERING,
          document: document as unknown as Prisma.InputJsonValue,
          schemaVersion: REPORT_SCHEMA_VERSION,
          promptVersion: PROMPT_VERSION,
          aiProvider: providerName,
          aiModel: model,
          astrologyCalculationId: calculation.id,
          generatedAt,
          lastError: null,
          lastErrorCategory: null,
        },
      }),
      prisma.reportOrder.update({ where: { id: order.id }, data: { status: ReportStatus.RENDERING } }),
    ]);

    console.info("report_interpretation_complete", {
      generatedReportId: job.id,
      provider: providerName,
      model,
      promptVersion: PROMPT_VERSION,
    });

    return { ok: true, generatedReportId: job.id, alreadyComplete: false };
  } catch (error) {
    const category: AiErrorCategory = isAiInterpretationError(error) ? error.category : "unknown";
    const message = error instanceof Error ? error.message : "Unknown interpretation failure.";
    await recordFailure(job.id, order.id, category, message);
    return { ok: false, reason: "failed", message };
  }
}

/** Drains the queue. The bounded loop keeps a worker invocation finite. */
export async function processGenerationQueue(limit = 5): Promise<{ processed: number }> {
  let processed = 0;

  for (let index = 0; index < limit; index += 1) {
    const jobId = await claimNextGenerationJob();
    if (!jobId) break;
    await runGenerationJob(jobId);
    processed += 1;
  }

  return { processed };
}
