import "server-only";

import { ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { reportDocumentSchema, type ReportDocument } from "@/lib/reports/document";
import { getReportRenderer, type ReportRenderer } from "@/lib/reports/renderer";
import {
  DEFAULT_SIGNED_URL_TTL_SECONDS,
  LocalStorageProvider,
  checksumOf,
  getStorageProvider,
  reportStorageKey,
} from "@/lib/storage/config";
import type { StorageProvider } from "@/lib/storage/provider";

/**
 * Rendering and delivery.
 *
 *   RENDERING -> (render PDF) -> (store privately) -> READY
 *
 * The stored artefact is private. Nothing here ever returns a public URL: a
 * download is only produced by an authenticated, ownership-checked caller, and
 * then only as a short-lived signed URL.
 */
export type RenderOutcome =
  | { ok: true; storageKey: string; checksum: string; alreadyRendered: boolean }
  | { ok: false; reason: "not_found" | "not_ready" | "invalid_document" | "failed"; message?: string };

export async function renderAndStoreReport(
  generatedReportId: string,
  deps: { renderer?: ReportRenderer; storage?: StorageProvider } = {},
): Promise<RenderOutcome> {
  const job = await prisma.generatedReport.findUnique({
    where: { id: generatedReportId },
    select: {
      id: true,
      status: true,
      document: true,
      storageKey: true,
      checksum: true,
      reportOrderId: true,
    },
  });

  if (!job) return { ok: false, reason: "not_found" };

  // Idempotent: a report already rendered is not rendered again.
  if (job.status === ReportStatus.READY && job.storageKey && job.checksum) {
    return { ok: true, storageKey: job.storageKey, checksum: job.checksum, alreadyRendered: true };
  }

  if (job.status !== ReportStatus.RENDERING) {
    return { ok: false, reason: "not_ready" };
  }

  const parsed = reportDocumentSchema.safeParse(job.document);
  if (!parsed.success) {
    await markRenderFailed(job.id, job.reportOrderId, "Stored document failed schema validation.");
    return { ok: false, reason: "invalid_document" };
  }

  const document: ReportDocument = parsed.data;
  const renderer = deps.renderer ?? getReportRenderer();
  const storage = deps.storage ?? getStorageProvider();

  try {
    const { bytes, mimeType, pageCount } = await renderer.render(document);
    const key = reportStorageKey(job.reportOrderId, job.id);
    const checksum = checksumOf(bytes);

    await storage.upload({
      key,
      body: bytes,
      contentType: mimeType,
      metadata: { reportOrderId: job.reportOrderId, checksum },
    });

    const readyAt = new Date();

    await prisma.$transaction([
      prisma.generatedReport.update({
        where: { id: job.id },
        data: {
          status: ReportStatus.READY,
          storageKey: key,
          checksum,
          fileSize: bytes.byteLength,
          mimeType,
          pageCount,
          readyAt,
          lastError: null,
          lastErrorCategory: null,
        },
      }),
      prisma.reportOrder.update({ where: { id: job.reportOrderId }, data: { status: ReportStatus.READY } }),
    ]);

    console.info("report_render_complete", { generatedReportId: job.id, bytes: bytes.byteLength, pageCount });

    return { ok: true, storageKey: key, checksum, alreadyRendered: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown rendering failure.";
    await markRenderFailed(job.id, job.reportOrderId, message);
    return { ok: false, reason: "failed", message };
  }
}

async function markRenderFailed(generatedReportId: string, reportOrderId: string, message: string): Promise<void> {
  await prisma.$transaction([
    prisma.generatedReport.update({
      where: { id: generatedReportId },
      data: {
        status: ReportStatus.FAILED,
        lastErrorCategory: "render",
        lastError: message.slice(0, 500),
        lastErrorAt: new Date(),
      },
    }),
    prisma.reportOrder.update({ where: { id: reportOrderId }, data: { status: ReportStatus.FAILED } }),
  ]);

  console.error("report_render_failed", { generatedReportId });
}

export type DownloadGrant =
  | { ok: true; mode: "signed"; url: string; expiresInSeconds: number; fileName: string }
  | { ok: true; mode: "stream"; bytes: Uint8Array; mimeType: string; fileName: string }
  | { ok: false; reason: "not_found" | "not_ready" };

/**
 * Produces a download for a report the user owns.
 *
 * Ownership is enforced inside the query, so another user's report id simply
 * resolves to "not found". Object storage returns a short-lived signed URL;
 * local development streams the bytes, because no public URL exists there.
 */
export async function createReportDownload(
  userId: string,
  reportOrderId: string,
  storage: StorageProvider = getStorageProvider(),
): Promise<DownloadGrant> {
  const order = await prisma.reportOrder.findFirst({
    where: { id: reportOrderId, userId },
    select: {
      id: true,
      reportSlugSnapshot: true,
      generatedReport: {
        select: { status: true, storageKey: true, mimeType: true },
      },
    },
  });

  if (!order) return { ok: false, reason: "not_found" };

  const report = order.generatedReport;
  if (!report || report.status !== ReportStatus.READY || !report.storageKey) {
    return { ok: false, reason: "not_ready" };
  }

  const fileName = `ravish-astro-${order.reportSlugSnapshot}-${order.id}.pdf`;

  if (storage instanceof LocalStorageProvider) {
    const bytes = await storage.read(report.storageKey);
    return { ok: true, mode: "stream", bytes: new Uint8Array(bytes), mimeType: report.mimeType ?? "application/pdf", fileName };
  }

  const url = await storage.getSignedUrl({
    key: report.storageKey,
    expiresInSeconds: DEFAULT_SIGNED_URL_TTL_SECONDS,
  });

  return { ok: true, mode: "signed", url, expiresInSeconds: DEFAULT_SIGNED_URL_TTL_SECONDS, fileName };
}

/**
 * Drains reports awaiting rendering.
 *
 * Kept separate from interpretation so a rendering failure never re-runs a paid
 * model call. The bounded loop keeps a worker invocation finite.
 */
export async function processRenderQueue(limit = 5): Promise<{ rendered: number }> {
  let rendered = 0;

  for (let index = 0; index < limit; index += 1) {
    const next = await prisma.generatedReport.findFirst({
      where: { status: ReportStatus.RENDERING },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!next) break;

    const outcome = await renderAndStoreReport(next.id);
    rendered += 1;

    // A job that neither rendered nor failed would loop forever; stop instead.
    if (!outcome.ok && outcome.reason === "not_ready") break;
  }

  return { rendered };
}
