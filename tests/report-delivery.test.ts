import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createReportDownload, renderAndStoreReport } from "@/lib/reports/delivery";
import { REPORT_SCHEMA_VERSION, STANDARD_DISCLAIMERS } from "@/lib/reports/document";
import { getReportRenderer } from "@/lib/reports/renderer";
import { LocalStorageProvider, checksumOf } from "@/lib/storage/config";
import { PROMPT_VERSION } from "@/lib/reports/specs";
import { notifyReportReady } from "@/lib/email/config";
import path from "node:path";
import { rm } from "node:fs/promises";

/**
 * Rendering and secure delivery, against real Postgres and a real PDF render.
 */
const RUN = `d${Date.now().toString(36)}`;
const STORAGE_ROOT = path.join(process.cwd(), ".storage-test", RUN);
const storage = new LocalStorageProvider(STORAGE_ROOT);

function documentFor(subject: string) {
  return {
    schemaVersion: REPORT_SCHEMA_VERSION as typeof REPORT_SCHEMA_VERSION,
    reportType: "CAREER",
    metadata: {
      subjectName: subject,
      generatedAt: new Date().toISOString(),
      astrologyCalculationId: "calc-test",
      calculationVersion: "1.0.0",
      ayanamsa: "LAHIRI",
      houseSystem: "WHOLE_SIGN",
      aiProvider: "development",
      aiModel: "development-fixture",
      promptVersion: PROMPT_VERSION,
    },
    title: "Career Reading",
    introduction: "i".repeat(140),
    calculatedFacts: [
      { label: "Ascendant (Lagna)", value: "Leo 12.5°" },
      { label: "Moon Sign (Rashi)", value: "Taurus" },
    ],
    sections: [
      {
        id: "professional-nature",
        title: "Your Professional Nature",
        summary: "A sufficiently long section summary for the renderer.",
        content: "c".repeat(400),
        highlights: ["A concrete takeaway"],
      },
    ],
    summary: "s".repeat(140),
    disclaimers: [...STANDARD_DISCLAIMERS],
  };
}

let userA: { id: string };
let userB: { id: string };
let definitionId: string;
let orderId: string;
let generatedReportId: string;

async function createUser(label: string) {
  return prisma.user.create({
    data: { name: `Delivery ${label}`, email: `${RUN}.${label}@example.test`, emailVerified: true },
    select: { id: true },
  });
}

async function createOrderFor(userId: string, subject: string) {
  const order = await prisma.reportOrder.create({
    data: {
      userId,
      reportDefinitionId: definitionId,
      status: ReportStatus.RENDERING,
      priceMinor: 49900,
      currency: "INR",
      reportNameSnapshot: "Career Report",
      reportSlugSnapshot: "career",
      priceSnapshot: 49900,
      currencySnapshot: "INR",
      inputSnapshot: {},
    },
    select: { id: true },
  });

  const generated = await prisma.generatedReport.create({
    data: {
      reportOrderId: order.id,
      status: ReportStatus.RENDERING,
      document: documentFor(subject),
      schemaVersion: REPORT_SCHEMA_VERSION,
      promptVersion: PROMPT_VERSION,
      aiProvider: "development",
      aiModel: "development-fixture",
    },
    select: { id: true },
  });

  return { orderId: order.id, generatedReportId: generated.id };
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for delivery tests.");

  userA = await createUser("a");
  userB = await createUser("b");

  const definition = await prisma.reportDefinition.create({
    data: {
      slug: `career-${RUN}`,
      name: "Career Report",
      shortDescription: "Work and direction.",
      description: "A structured career reading.",
      priceMinor: 49900,
      currency: "INR",
      estimatedPages: 18,
      sectionsIncluded: [],
      requiredInputs: ["birthProfile"],
      reportType: "CAREER",
      requiredFields: [],
      sections: [],
    },
    select: { id: true },
  });
  definitionId = definition.id;

  const created = await createOrderFor(userA.id, "Ravish Sharma");
  orderId = created.orderId;
  generatedReportId = created.generatedReportId;
});

afterAll(async () => {
  await prisma.generatedReport.deleteMany({ where: { reportOrder: { userId: { in: [userA.id, userB.id] } } } });
  await prisma.reportOrder.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
  await prisma.reportDefinition.deleteMany({ where: { id: definitionId } });
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  await rm(STORAGE_ROOT, { recursive: true, force: true });
  await prisma.$disconnect();
});

describe("report rendering", () => {
  it("renders a real PDF from a validated document", async () => {
    const { bytes, mimeType, pageCount } = await getReportRenderer().render(documentFor("Ravish Sharma"));

    expect(mimeType).toBe("application/pdf");
    expect(bytes.byteLength).toBeGreaterThan(1000);
    // A PDF always starts with %PDF-
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(pageCount).toBeGreaterThan(0);
  }, 60_000);

  it("stores the artefact, records a checksum and moves to READY", async () => {
    const outcome = await renderAndStoreReport(generatedReportId, { storage });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.alreadyRendered).toBe(false);

    const stored = await prisma.generatedReport.findUnique({
      where: { id: generatedReportId },
      select: { status: true, storageKey: true, checksum: true, fileSize: true, mimeType: true, readyAt: true },
    });

    expect(stored?.status).toBe(ReportStatus.READY);
    expect(stored?.storageKey).toBe(outcome.storageKey);
    expect(stored?.mimeType).toBe("application/pdf");
    expect(stored?.fileSize).toBeGreaterThan(1000);
    expect(stored?.readyAt).not.toBeNull();

    // The recorded checksum must match the bytes actually stored.
    const bytes = await storage.read(outcome.storageKey);
    expect(checksumOf(new Uint8Array(bytes))).toBe(stored?.checksum);

    const order = await prisma.reportOrder.findUnique({ where: { id: orderId }, select: { status: true } });
    expect(order?.status).toBe(ReportStatus.READY);
  }, 60_000);

  it("is idempotent: re-rendering a READY report does not redo the work", async () => {
    const again = await renderAndStoreReport(generatedReportId, { storage });

    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.alreadyRendered).toBe(true);
  });

  it("fails a report whose stored document does not validate", async () => {
    const broken = await createOrderFor(userA.id, "Broken Document");
    await prisma.generatedReport.update({
      where: { id: broken.generatedReportId },
      data: { document: { not: "a report" } },
    });

    const outcome = await renderAndStoreReport(broken.generatedReportId, { storage });
    expect(outcome).toMatchObject({ ok: false, reason: "invalid_document" });

    const stored = await prisma.generatedReport.findUnique({
      where: { id: broken.generatedReportId },
      select: { status: true, lastErrorCategory: true },
    });
    expect(stored?.status).toBe(ReportStatus.FAILED);
    expect(stored?.lastErrorCategory).toBe("render");
  });
});

describe("download authorization", () => {
  it("gives the owner their report", async () => {
    const grant = await createReportDownload(userA.id, orderId, storage);

    expect(grant.ok).toBe(true);
    if (!grant.ok || grant.mode !== "stream") return;
    expect(Buffer.from(grant.bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(grant.fileName).toContain("career");
  });

  it("refuses another user's report as not found", async () => {
    const grant = await createReportDownload(userB.id, orderId, storage);
    expect(grant).toEqual({ ok: false, reason: "not_found" });
  });

  it("refuses an unknown order id", async () => {
    const grant = await createReportDownload(userA.id, "does-not-exist", storage);
    expect(grant).toEqual({ ok: false, reason: "not_found" });
  });

  it("refuses a report that is not yet ready", async () => {
    const pending = await createOrderFor(userA.id, "Still Rendering");
    const grant = await createReportDownload(userA.id, pending.orderId, storage);
    expect(grant).toEqual({ ok: false, reason: "not_ready" });
  });
});

describe("email delivery", () => {
  it("reports honestly that nothing was sent when no provider is configured", async () => {
    const result = await notifyReportReady(
      { to: "someone@example.test", customerName: "Ravish", reportName: "Career Report", reportUrl: "https://example.test/r" },
      { EMAIL_PROVIDER_API_KEY: "", EMAIL_FROM: "" } as unknown as NodeJS.ProcessEnv,
    );

    expect(result).toEqual({ sent: false, reason: "not_configured" });
  });
});
