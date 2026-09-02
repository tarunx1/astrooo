import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PaymentStatus, ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createBirthProfile } from "@/lib/account/birth-profiles";
import { DevelopmentAstrologyProvider } from "@/lib/astrology/provider";
import { normalizeBirthDetails } from "@/lib/kundli/normalize";
import type { PaymentProvider, ProviderPayment } from "@/lib/payments/provider";
import { processRazorpayWebhook } from "@/lib/payments/webhooks";
import {
  applyVerifiedProviderPayment,
  createReportOrderForUser,
  getOwnedCheckoutOrder,
  listAccountReports,
  markProviderOrderPaid,
  verifyCheckoutPaymentForUser,
} from "@/lib/reports/orders";

const RUN_ID = `rc${Date.now().toString(36)}`;
const ORIGINAL_CHECKOUT_FLAG = process.env.REPORT_CHECKOUT_ENABLED;

function normalizedBirthDetails(name = `Report Buyer ${RUN_ID}`) {
  return normalizeBirthDetails({
    name,
    dateOfBirth: "1990-05-20",
    timeOfBirth: "08:15",
    timeAccuracy: "EXACT",
    placeId: "dev:delhi-in",
    displayName: "Delhi, India",
    city: "Delhi",
    region: "Delhi",
    country: "India",
    latitude: 28.6139,
    longitude: 77.209,
    timezone: "Asia/Kolkata",
  });
}

let providerOrderSequence = 0;

function nextProviderOrderId(): string {
  providerOrderSequence += 1;
  return `${RUN_ID}_provider_order_${providerOrderSequence}`;
}

function capturedPayment(providerOrderId: string, paymentId = `${providerOrderId}_pay_captured`): ProviderPayment {
  return {
    provider: "razorpay",
    id: paymentId,
    orderId: providerOrderId,
    amountMinor: 79900,
    currency: "INR",
    status: "captured",
    capturedAt: new Date("2026-09-02T10:00:00.000Z"),
  };
}

function fakeProvider(providerOrderId: string = nextProviderOrderId(), overrides: Partial<PaymentProvider> = {}): PaymentProvider {
  return {
    async createOrder() {
      return { provider: "razorpay", id: providerOrderId, amountMinor: 79900, currency: "INR", status: "created" };
    },
    async fetchPayment() {
      return capturedPayment(providerOrderId);
    },
    verifyPaymentSignature() {
      return true;
    },
    verifyWebhookSignature() {
      return true;
    },
    async refund() {
      return {};
    },
    ...overrides,
  };
}

async function createUser(label: string) {
  return prisma.user.create({
    data: { name: `Report ${label}`, email: `${RUN_ID}.${label}@example.test`, emailVerified: true },
    select: { id: true },
  });
}

let userA!: { id: string };
let userB!: { id: string };
let reportDefinitionId!: string;
let profileAId!: string;
let seededCalculationId!: string;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set for report commerce tests.");
  process.env.REPORT_CHECKOUT_ENABLED = "true";

  userA = await createUser("a");
  userB = await createUser("b");
  profileAId = await createBirthProfile(userA.id, normalizedBirthDetails());

  const result = await new DevelopmentAstrologyProvider().calculateKundli(normalizedBirthDetails());
  const calculation = await prisma.astrologyCalculation.upsert({
    where: {
      calculationType_inputHash_provider_calculationVersion: {
        calculationType: "JANAM_KUNDLI",
        inputHash: result.metadata.inputHash,
        provider: result.calculationMetadata.provider,
        calculationVersion: result.calculationMetadata.calculationVersion,
      },
    },
    create: {
      calculationType: "JANAM_KUNDLI",
      provider: result.calculationMetadata.provider,
      providerVersion: result.calculationMetadata.providerVersion,
      calculationVersion: result.calculationMetadata.calculationVersion,
      ayanamsa: result.calculationMetadata.ayanamsa,
      houseSystem: result.calculationMetadata.houseSystem,
      calculatedAt: new Date(result.calculationMetadata.calculatedAt),
      inputHash: result.metadata.inputHash,
      input: normalizedBirthDetails() as unknown as object,
      result: result as unknown as object,
      status: "READY",
    },
    update: {},
    select: { id: true },
  });
  seededCalculationId = calculation.id;

  const reportDefinition = await prisma.reportDefinition.create({
    data: {
      slug: `${RUN_ID}-career`,
      name: "Test Career Report",
      shortDescription: "Test report.",
      description: "A test-only report definition.",
      priceMinor: 79900,
      currency: "INR",
      estimatedPages: 18,
      sectionsIncluded: ["Career strengths"],
      requiredInputs: ["birthProfile"],
      reportType: "TEST_CAREER",
      requiredFields: ["birthProfile"],
      sections: ["Career strengths"],
      isActive: true,
    },
    select: { id: true },
  });
  reportDefinitionId = reportDefinition.id;
});

afterAll(async () => {
  process.env.REPORT_CHECKOUT_ENABLED = ORIGINAL_CHECKOUT_FLAG;
  await prisma.paymentWebhookEvent.deleteMany({ where: { providerEventId: { startsWith: RUN_ID } } });
  await prisma.payment.deleteMany({ where: { OR: [{ providerOrderId: { startsWith: RUN_ID } }, { providerPaymentId: { startsWith: RUN_ID } }] } });
  const userIds = [userA?.id, userB?.id].filter((id): id is string => Boolean(id));
  if (userIds.length > 0) {
    await prisma.reportOrder.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.birthProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  if (reportDefinitionId) await prisma.reportDefinition.deleteMany({ where: { id: reportDefinitionId } });
  if (seededCalculationId) await prisma.astrologyCalculation.deleteMany({ where: { id: seededCalculationId } });
  await prisma.$disconnect();
});

describe("report order security", () => {
  it("does not start checkout when the feature flag is disabled", async () => {
    process.env.REPORT_CHECKOUT_ENABLED = "false";
    const outcome = await createReportOrderForUser(userA.id, { reportDefinitionId, birthProfileId: profileAId }, fakeProvider());
    expect(outcome.ok).toBe(false);
    process.env.REPORT_CHECKOUT_ENABLED = "true";
  });

  it("refuses another user's birth profile", async () => {
    const outcome = await createReportOrderForUser(userB.id, { reportDefinitionId, birthProfileId: profileAId }, fakeProvider());
    expect(outcome).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("creates a report order from DB pricing and an immutable calculation snapshot", async () => {
    const providerOrder = `${RUN_ID}_provider_order`;
    const outcome = await createReportOrderForUser(userA.id, { reportDefinitionId, birthProfileId: profileAId }, fakeProvider(providerOrder));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const row = await prisma.reportOrder.findUniqueOrThrow({
      where: { id: outcome.orderId },
      select: { priceMinor: true, currency: true, reportNameSnapshot: true, astrologyCalculationId: true, providerOrderId: true },
    });
    expect(row).toMatchObject({
      priceMinor: 79900,
      currency: "INR",
      reportNameSnapshot: "Test Career Report",
      providerOrderId: providerOrder,
    });
    expect(row.astrologyCalculationId).toBeTruthy();
  });

  it("scopes checkout and account reports to the owning user", async () => {
    const outcome = await createReportOrderForUser(userA.id, { reportDefinitionId, birthProfileId: profileAId }, fakeProvider());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    await expect(getOwnedCheckoutOrder(userA.id, outcome.orderId)).resolves.toMatchObject({ id: outcome.orderId });
    await expect(getOwnedCheckoutOrder(userB.id, outcome.orderId)).resolves.toBeNull();

    const reportsA = await listAccountReports(userA.id);
    const reportsB = await listAccountReports(userB.id);
    expect(reportsA.map((report) => report.id)).toContain(outcome.orderId);
    expect(reportsB.map((report) => report.id)).not.toContain(outcome.orderId);
  });

  it("rejects checkout verification for a cross-user order", async () => {
    const outcome = await createReportOrderForUser(userA.id, { reportDefinitionId, birthProfileId: profileAId }, fakeProvider());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const providerOrderId = nextProviderOrderId();
    const result = await verifyCheckoutPaymentForUser({
      userId: userB.id,
      reportOrderId: outcome.orderId,
      providerOrderId,
      providerPaymentId: capturedPayment(providerOrderId).id,
      signature: "valid",
      paymentProvider: fakeProvider(providerOrderId),
    });
    expect(result.ok).toBe(false);
  });

  it("rejects mismatched payment amount, currency and provider order id", async () => {
    const outcome = await createReportOrderForUser(userA.id, { reportDefinitionId, birthProfileId: profileAId }, fakeProvider());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const order = await prisma.reportOrder.findUniqueOrThrow({ where: { id: outcome.orderId }, select: { providerOrderId: true } });
    const payment = capturedPayment(order.providerOrderId ?? "");

    await expect(applyVerifiedProviderPayment(outcome.orderId, { ...payment, amountMinor: 100 })).rejects.toThrow(
      "Payment amount mismatch.",
    );
    await expect(applyVerifiedProviderPayment(outcome.orderId, { ...payment, currency: "USD" as "INR" })).rejects.toThrow(
      "Payment currency mismatch.",
    );
    await expect(applyVerifiedProviderPayment(outcome.orderId, { ...payment, orderId: "order_other" })).rejects.toThrow(
      "Provider order mismatch.",
    );
  });

  it("marks captured payments paid idempotently without changing paidAt", async () => {
    const providerOrderId = `${RUN_ID}_provider_order_idempotent`;
    const provider = fakeProvider(providerOrderId);
    const outcome = await createReportOrderForUser(userA.id, { reportDefinitionId, birthProfileId: profileAId }, provider);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const payment = capturedPayment(providerOrderId);

    await applyVerifiedProviderPayment(outcome.orderId, payment);
    await applyVerifiedProviderPayment(outcome.orderId, payment);

    const row = await prisma.reportOrder.findUniqueOrThrow({
      where: { id: outcome.orderId },
      select: { status: true, paidAt: true, payments: { select: { id: true } } },
    });
    expect(row.status).toBe(ReportStatus.PAID);
    expect(row.paidAt?.toISOString()).toBe("2026-09-02T10:00:00.000Z");
    expect(row.payments).toHaveLength(1);
  });

  it("handles order.paid before payment.captured without premature fulfilment", async () => {
    const providerOrderId = `${RUN_ID}_provider_order_seq`;
    const provider = fakeProvider(providerOrderId);
    const outcome = await createReportOrderForUser(userA.id, { reportDefinitionId, birthProfileId: profileAId }, provider);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    await markProviderOrderPaid(providerOrderId);
    const beforeCapture = await prisma.reportOrder.findUniqueOrThrow({ where: { id: outcome.orderId }, select: { status: true } });
    expect(beforeCapture.status).toBe(ReportStatus.PENDING_PAYMENT);

    await applyVerifiedProviderPayment(outcome.orderId, capturedPayment(providerOrderId));
    await markProviderOrderPaid(providerOrderId);
    const afterCapture = await prisma.reportOrder.findUniqueOrThrow({ where: { id: outcome.orderId }, select: { status: true } });
    expect(afterCapture.status).toBe(ReportStatus.PAID);
  });
});

describe("Razorpay webhook handling", () => {
  it("stores webhook events idempotently and marks captured payments", async () => {
    const providerOrderId = `${RUN_ID}_provider_order_webhook`;
    const provider = fakeProvider(providerOrderId);
    const outcome = await createReportOrderForUser(userA.id, { reportDefinitionId, birthProfileId: profileAId }, provider);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const rawBody = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: `${RUN_ID}_webhook_pay`,
            order_id: providerOrderId,
            amount: 79900,
            currency: "INR",
            status: "captured",
            captured: true,
            created_at: 1788343200,
          },
        },
      },
    });

    await expect(processRazorpayWebhook(rawBody, "sig", `${RUN_ID}_event_1`, provider)).resolves.toEqual({
      ok: true,
      duplicate: false,
    });
    await expect(processRazorpayWebhook(rawBody, "sig", `${RUN_ID}_event_1`, provider)).resolves.toEqual({
      ok: true,
      duplicate: true,
    });

    const row = await prisma.reportOrder.findUniqueOrThrow({ where: { id: outcome.orderId }, select: { status: true } });
    expect([ReportStatus.PAID, ReportStatus.QUEUED]).toContain(row.status);
  });

  it("records failed payment attempts without marking the report paid", async () => {
    const outcome = await createReportOrderForUser(userA.id, { reportDefinitionId, birthProfileId: profileAId }, fakeProvider());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const order = await prisma.reportOrder.findUniqueOrThrow({ where: { id: outcome.orderId }, select: { providerOrderId: true } });
    const providerOrderId = order.providerOrderId ?? "";
    const rawBody = JSON.stringify({
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: `${RUN_ID}_failed_pay`,
            order_id: providerOrderId,
            amount: 79900,
            currency: "INR",
            status: "failed",
            captured: false,
          },
        },
      },
    });

    await processRazorpayWebhook(rawBody, "sig", `${RUN_ID}_event_failed`, fakeProvider());

    const [storedOrder, payment] = await Promise.all([
      prisma.reportOrder.findUniqueOrThrow({ where: { id: outcome.orderId }, select: { status: true } }),
      prisma.payment.findUniqueOrThrow({ where: { providerPaymentId: `${RUN_ID}_failed_pay` }, select: { status: true } }),
    ]);
    expect(storedOrder.status).toBe(ReportStatus.PENDING_PAYMENT);
    expect(payment.status).toBe(PaymentStatus.FAILED);
  });

  it("rejects invalid webhook signatures before writing an event", async () => {
    const provider = fakeProvider(undefined, { verifyWebhookSignature: () => false });
    await expect(processRazorpayWebhook("{\"event\":\"payment.captured\"}", "bad", `${RUN_ID}_bad_event`, provider)).rejects.toThrow();
    await expect(prisma.paymentWebhookEvent.findUnique({ where: { providerEventId: `${RUN_ID}_bad_event` } })).resolves.toBeNull();
  });
});
