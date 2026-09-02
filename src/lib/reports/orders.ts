import "server-only";

import { PaymentStatus, ReportStatus, type Prisma } from "@prisma/client";
import { astrologyCalculationConfig } from "@/config/astrology";
import { getOwnedBirthProfile } from "@/lib/account/birth-profiles";
import { birthProfileToNormalized } from "@/lib/account/profile-kundli";
import { getAstrologyProvider } from "@/lib/astrology/provider";
import { isAstrologyProviderError } from "@/lib/astrology/errors";
import { prisma } from "@/lib/db/prisma";
import { enqueueReportGeneration } from "@/lib/reports/generation";
import { isReportCheckoutEnabled, getPaymentProvider, getRazorpayPublicKey } from "@/lib/payments/config";
import { PaymentSignatureError, PaymentUnavailableError, PaymentValidationError } from "@/lib/payments/errors";
import type { PaymentProvider, ProviderPayment } from "@/lib/payments/provider";
import { isValidMinorUnitAmount } from "@/lib/payments/provider";
import { createKundliInputHash } from "@/lib/kundli/normalize";

export type CreateReportOrderInput = {
  reportDefinitionId: string;
  birthProfileId: string;
};

export type CreateReportOrderOutcome =
  | { ok: true; orderId: string }
  | { ok: false; reason: "disabled" | "not_found" | "provider_error"; message: string };

export type CheckoutReportOrder = {
  id: string;
  reportName: string;
  reportSlug: string;
  profileName: string;
  amountMinor: number;
  currency: "INR";
  providerOrderId: string | null;
  keyId: string | null;
  userName: string;
  userEmail: string;
  status: ReportStatus;
};

export type AccountReportSummary = {
  id: string;
  reportName: string;
  reportSlug: string;
  profileName: string;
  status: ReportStatus;
  amountMinor: number;
  currency: string;
  createdAt: Date;
  paidAt: Date | null;
};

function toPaymentStatus(status: ProviderPayment["status"]): PaymentStatus {
  if (status === "captured") return PaymentStatus.CAPTURED;
  if (status === "authorized") return PaymentStatus.AUTHORIZED;
  if (status === "failed") return PaymentStatus.FAILED;
  if (status === "refunded") return PaymentStatus.REFUNDED;
  return PaymentStatus.PENDING;
}

async function resolveAstrologyCalculation(userId: string, birthProfileId: string) {
  const profile = await getOwnedBirthProfile(userId, birthProfileId);
  if (!profile) return null;

  const normalized = birthProfileToNormalized(profile);
  const inputHash = createKundliInputHash(normalized);
  const existing = await prisma.astrologyCalculation.findFirst({
    where: { calculationType: "JANAM_KUNDLI", inputHash },
    select: { id: true },
  });
  if (existing) return { id: existing.id, normalized, profile };

  try {
    const result = await getAstrologyProvider().calculateKundli(normalized);
    const created = await prisma.astrologyCalculation.create({
      data: {
        birthProfileId,
        calculationType: "JANAM_KUNDLI",
        provider: result.calculationMetadata.provider,
        providerVersion: result.calculationMetadata.providerVersion,
        calculationVersion: result.calculationMetadata.calculationVersion,
        ayanamsa: result.calculationMetadata.ayanamsa ?? astrologyCalculationConfig.ayanamsa,
        houseSystem: result.calculationMetadata.houseSystem ?? astrologyCalculationConfig.houseSystem,
        calculatedAt: new Date(result.calculationMetadata.calculatedAt),
        inputHash: result.metadata.inputHash,
        input: normalized as unknown as Prisma.InputJsonValue,
        result: result as unknown as Prisma.InputJsonValue,
        status: "READY",
      },
      select: { id: true },
    });
    return { id: created.id, normalized, profile };
  } catch (error) {
    if (isAstrologyProviderError(error)) throw new Error(error.userMessage);
    throw new Error("The Kundli calculation service is temporarily unavailable. Please try again.");
  }
}

export async function createReportOrderForUser(
  userId: string,
  input: CreateReportOrderInput,
  paymentProvider?: PaymentProvider,
): Promise<CreateReportOrderOutcome> {
  if (!isReportCheckoutEnabled()) {
    return {
      ok: false,
      reason: "disabled",
      message: "Report checkout is not enabled yet. Payments will open after report delivery is ready.",
    };
  }

  const report = await prisma.reportDefinition.findFirst({
    where: { id: input.reportDefinitionId, isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      priceMinor: true,
      currency: true,
    },
  });
  if (!report || report.currency !== "INR" || !isValidMinorUnitAmount(report.priceMinor)) {
    return { ok: false, reason: "not_found", message: "That report is not available." };
  }

  const resolved = await resolveAstrologyCalculation(userId, input.birthProfileId).catch((error: Error) => error);
  if (!resolved || resolved instanceof Error) {
    return {
      ok: false,
      reason: resolved instanceof Error ? "provider_error" : "not_found",
      message: resolved instanceof Error ? resolved.message : "That birth profile is not available.",
    };
  }

  const order = await prisma.reportOrder.create({
    data: {
      userId,
      reportDefinitionId: report.id,
      birthProfileId: input.birthProfileId,
      astrologyCalculationId: resolved.id,
      status: ReportStatus.PENDING_PAYMENT,
      priceMinor: report.priceMinor,
      currency: report.currency,
      reportNameSnapshot: report.name,
      reportSlugSnapshot: report.slug,
      priceSnapshot: report.priceMinor,
      currencySnapshot: report.currency,
      inputSnapshot: {
        calculationId: resolved.id,
        birthProfileId: input.birthProfileId,
        calculationVersion: astrologyCalculationConfig.version,
      },
    },
    select: { id: true },
  });

  let providerOrder;
  try {
    const provider = paymentProvider ?? getPaymentProvider();
    providerOrder = await provider.createOrder({
      amountMinor: report.priceMinor,
      currency: "INR",
      receipt: order.id.slice(0, 40),
      notes: {
        reportOrderId: order.id,
        reportDefinitionId: report.id,
      },
    });
  } catch (error) {
    console.info("report_payment_order_failed", {
      reportOrderId: order.id,
      reportDefinitionId: report.id,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return {
      ok: false,
      reason: "provider_error",
      message: "Payment could not be started. Please try again in a few minutes.",
    };
  }

  await prisma.$transaction([
    prisma.reportOrder.update({
      where: { id: order.id },
      data: { providerOrderId: providerOrder.id },
    }),
    prisma.payment.create({
      data: {
        userId,
        reportOrderId: order.id,
        provider: "razorpay",
        providerOrderId: providerOrder.id,
        status: PaymentStatus.PENDING,
        amountPaise: report.priceMinor,
        currency: "INR",
        rawResponse: providerOrder as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);

  return { ok: true, orderId: order.id };
}

export async function getOwnedCheckoutOrder(userId: string, orderId: string): Promise<CheckoutReportOrder | null> {
  const row = await prisma.reportOrder.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      reportNameSnapshot: true,
      reportSlugSnapshot: true,
      priceMinor: true,
      currency: true,
      status: true,
      providerOrderId: true,
      user: { select: { name: true, email: true } },
      birthProfile: { select: { name: true } },
    },
  });

  if (!row || row.currency !== "INR") return null;

  return {
    id: row.id,
    reportName: row.reportNameSnapshot,
    reportSlug: row.reportSlugSnapshot,
    profileName: row.birthProfile?.name ?? "Saved birth profile",
    amountMinor: row.priceMinor,
    currency: "INR",
    providerOrderId: row.providerOrderId,
    keyId: getRazorpayPublicKey(),
    userName: row.user.name,
    userEmail: row.user.email,
    status: row.status,
  };
}

export async function listAccountReports(userId: string): Promise<AccountReportSummary[]> {
  const rows = await prisma.reportOrder.findMany({
    where: { userId },
    select: {
      id: true,
      reportNameSnapshot: true,
      reportSlugSnapshot: true,
      status: true,
      priceMinor: true,
      currency: true,
      createdAt: true,
      paidAt: true,
      birthProfile: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    reportName: row.reportNameSnapshot,
    reportSlug: row.reportSlugSnapshot,
    profileName: row.birthProfile?.name ?? "Deleted birth profile",
    status: row.status,
    amountMinor: row.priceMinor,
    currency: row.currency,
    createdAt: row.createdAt,
    paidAt: row.paidAt,
  }));
}

export async function verifyCheckoutPaymentForUser({
  userId,
  reportOrderId,
  providerOrderId,
  providerPaymentId,
  signature,
  paymentProvider,
}: {
  userId: string;
  reportOrderId: string;
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
  paymentProvider?: PaymentProvider;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const order = await prisma.reportOrder.findFirst({
    where: { id: reportOrderId, userId },
    select: { id: true, userId: true, providerOrderId: true, priceMinor: true, currency: true, status: true },
  });
  if (!order || !order.providerOrderId || order.providerOrderId !== providerOrderId) {
    return { ok: false, message: "Payment could not be matched to this order." };
  }

  const provider = paymentProvider ?? getPaymentProvider();
  if (!provider.verifyPaymentSignature({ orderId: providerOrderId, paymentId: providerPaymentId, signature })) {
    throw new PaymentSignatureError();
  }

  const payment = await provider.fetchPayment(providerPaymentId);
  await applyVerifiedProviderPayment(order.id, payment);
  return { ok: true };
}

export async function applyVerifiedProviderPayment(reportOrderId: string, payment: ProviderPayment): Promise<void> {
  const order = await prisma.reportOrder.findUnique({
    where: { id: reportOrderId },
    select: { id: true, userId: true, providerOrderId: true, priceMinor: true, currency: true, paidAt: true },
  });
  if (!order || !order.providerOrderId) throw new PaymentValidationError("Payment order is not payable.");
  if (payment.orderId !== order.providerOrderId) throw new PaymentValidationError("Provider order mismatch.");
  if (payment.amountMinor !== order.priceMinor) throw new PaymentValidationError("Payment amount mismatch.");
  if (payment.currency !== order.currency) throw new PaymentValidationError("Payment currency mismatch.");

  const status = toPaymentStatus(payment.status);
  await prisma.$transaction(async (tx) => {
    await tx.payment.upsert({
      where: { providerPaymentId: payment.id },
      create: {
        userId: order.userId,
        reportOrderId: order.id,
        provider: payment.provider,
        providerOrderId: payment.orderId,
        providerPaymentId: payment.id,
        providerRef: payment.id,
        status,
        amountPaise: payment.amountMinor,
        currency: payment.currency,
        capturedAt: status === PaymentStatus.CAPTURED ? payment.capturedAt ?? new Date() : null,
        rawResponse: payment as unknown as Prisma.InputJsonValue,
      },
      update: {
        status,
        capturedAt: status === PaymentStatus.CAPTURED ? payment.capturedAt ?? new Date() : undefined,
        rawResponse: payment as unknown as Prisma.InputJsonValue,
      },
    });

    if (status === PaymentStatus.CAPTURED) {
      await tx.reportOrder.update({
        where: { id: order.id },
        data: {
          status: ReportStatus.PAID,
          paidAt: order.paidAt ?? payment.capturedAt ?? new Date(),
        },
      });
    }
  });

  // Queue generation only after the payment transaction has committed.
  // enqueueReportGeneration is idempotent, so repeated webhooks are harmless.
  if (status === PaymentStatus.CAPTURED) {
    await enqueueReportGeneration(order.id);
  }
}

export async function markProviderOrderPaid(providerOrderId: string): Promise<void> {
  const order = await prisma.reportOrder.findUnique({
    where: { providerOrderId },
    select: { id: true, status: true, paidAt: true },
  });
  if (!order) return;

  const captured = await prisma.payment.findFirst({
    where: { reportOrderId: order.id, providerOrderId, status: PaymentStatus.CAPTURED },
    select: { id: true },
  });
  if (!captured) return;

  await prisma.reportOrder.update({
    where: { id: order.id },
    data: { status: ReportStatus.PAID, paidAt: order.paidAt ?? new Date() },
  });

  await enqueueReportGeneration(order.id);
}

export function assertCheckoutPossible(order: CheckoutReportOrder): void {
  if (!isReportCheckoutEnabled()) throw new PaymentUnavailableError("Report checkout is not enabled yet.");
  if (order.status !== ReportStatus.PENDING_PAYMENT) throw new PaymentValidationError("This report order is not payable.");
  if (!order.providerOrderId || !order.keyId) throw new PaymentUnavailableError("Razorpay checkout is not configured.");
}
