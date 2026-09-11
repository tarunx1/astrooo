import "server-only";

import {
  ConsultationMode,
  ConsultationStatus,
  EarningStatus,
  InventoryStatus,
  OrderStatus,
  PanditOnboardingStatus,
  PayoutStatus,
  ProductType,
  ReportStatus,
  TicketStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Platform analytics.
 *
 * Every number here is a count or a sum over rows that exist. Nothing is
 * projected, extrapolated, or inferred from a related figure - a metric this
 * application cannot compute is absent rather than estimated, because a
 * plausible-looking wrong number in an operations dashboard is worse than a
 * gap that prompts a question.
 *
 * "Active users" in particular is defined as *users with a live session*, which
 * is the only activity signal this application actually records. It is labelled
 * that way in the UI rather than as the vaguer "active users", which would
 * invite a reading the data does not support.
 */

export type PlatformAnalytics = {
  users: {
    total: number;
    newThisWeek: number;
    newThisMonth: number;
    withLiveSession: number;
    customers: number;
    pandits: number;
    employees: number;
    admins: number;
  };
  pandits: Record<PanditOnboardingStatus, number> & { total: number };
  consultations: {
    scheduled: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    noShow: number;
    byMode: Record<ConsultationMode, number>;
    completedThisMonth: number;
  };
  revenue: {
    grossPaise: number;
    platformCommissionPaise: number;
    panditEarningsPaise: number;
    pendingPayoutPaise: number;
    processingPayoutPaise: number;
    paidPayoutPaise: number;
    failedPayoutCount: number;
    productRevenuePaise: number;
    reportRevenuePaise: number;
  };
  reports: {
    orders: number;
    ready: number;
    failed: number;
    inProgress: number;
  };
  commerce: {
    paidOrders: number;
    pendingFulfilment: number;
    gemstoneOrders: number;
    activeGemstones: number;
    lowStock: number;
    outOfStock: number;
  };
  tickets: Record<TicketStatus, number> & { backlog: number };
  generatedAt: Date;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function getPlatformAnalytics(now: Date = new Date()): Promise<PlatformAnalytics> {
  const weekAgo = new Date(now.getTime() - WEEK_MS);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    userTotal,
    newThisWeek,
    newThisMonth,
    liveSessions,
    usersByRole,
    panditsByStatus,
    panditTotal,
    consultationsByStatus,
    consultationsByMode,
    completedThisMonth,
    earningTotals,
    earningsByStatus,
    payoutsByStatus,
    productRevenue,
    reportRevenue,
    reportOrderTotal,
    reportsByStatus,
    paidOrders,
    pendingFulfilment,
    gemstoneOrderItems,
    activeGemstones,
    inventoryByStatus,
    ticketsByStatus,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    // A live session is the one activity signal recorded. Distinct users rather
    // than sessions, since one person may be signed in on several devices.
    prisma.session
      .findMany({ where: { expiresAt: { gt: now } }, select: { userId: true }, distinct: ["userId"] })
      .then((rows) => rows.length),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.panditProfile.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.panditProfile.count(),
    prisma.consultation.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.consultation.groupBy({ by: ["mode"], _count: { _all: true } }),
    prisma.consultation.count({
      where: { status: ConsultationStatus.COMPLETED, completedAt: { gte: startOfMonth } },
    }),
    prisma.earningTransaction.aggregate({
      where: { status: { not: EarningStatus.REVERSED } },
      _sum: { grossAmountPaise: true, platformCommissionPaise: true, netPayablePaise: true },
    }),
    prisma.earningTransaction.groupBy({
      by: ["status"],
      _sum: { netPayablePaise: true },
      _count: { _all: true },
    }),
    prisma.payout.groupBy({ by: ["status"], _sum: { amountPaise: true }, _count: { _all: true } }),
    prisma.order.aggregate({
      where: { paidAt: { not: null } },
      _sum: { totalPaise: true },
    }),
    prisma.reportOrder.aggregate({
      where: { paidAt: { not: null } },
      _sum: { priceSnapshot: true },
    }),
    prisma.reportOrder.count(),
    prisma.generatedReport.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.count({ where: { paidAt: { not: null } } }),
    prisma.order.count({
      where: { status: { in: [OrderStatus.PAID, OrderStatus.CONFIRMED, OrderStatus.PROCESSING] } },
    }),
    prisma.orderItem.findMany({
      where: { product: { type: ProductType.GEMSTONE } },
      select: { orderId: true },
      distinct: ["orderId"],
    }),
    prisma.product.count({ where: { type: ProductType.GEMSTONE, active: true } }),
    prisma.inventory.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const roleCount = (role: UserRole) =>
    usersByRole.find((row) => row.role === role)?._count._all ?? 0;

  const panditStatusCounts = Object.fromEntries(
    Object.values(PanditOnboardingStatus).map((status) => [status, 0]),
  ) as Record<PanditOnboardingStatus, number>;
  for (const row of panditsByStatus) panditStatusCounts[row.status] = row._count._all;

  const consultationCount = (status: ConsultationStatus) =>
    consultationsByStatus.find((row) => row.status === status)?._count._all ?? 0;

  const modeCounts = Object.fromEntries(
    Object.values(ConsultationMode).map((mode) => [mode, 0]),
  ) as Record<ConsultationMode, number>;
  for (const row of consultationsByMode) modeCounts[row.mode] = row._count._all;

  const earningNet = (status: EarningStatus) =>
    earningsByStatus.find((row) => row.status === status)?._sum.netPayablePaise ?? 0;

  const payoutSum = (status: PayoutStatus) =>
    payoutsByStatus.find((row) => row.status === status)?._sum.amountPaise ?? 0;

  const payoutCount = (status: PayoutStatus) =>
    payoutsByStatus.find((row) => row.status === status)?._count._all ?? 0;

  const reportCount = (status: ReportStatus) =>
    reportsByStatus.find((row) => row.status === status)?._count._all ?? 0;

  const inventoryCount = (status: InventoryStatus) =>
    inventoryByStatus.find((row) => row.status === status)?._count._all ?? 0;

  const ticketCounts = Object.fromEntries(
    Object.values(TicketStatus).map((status) => [status, 0]),
  ) as Record<TicketStatus, number>;
  for (const row of ticketsByStatus) ticketCounts[row.status] = row._count._all;

  return {
    users: {
      total: userTotal,
      newThisWeek,
      newThisMonth,
      withLiveSession: liveSessions,
      customers: roleCount(UserRole.CUSTOMER),
      pandits: roleCount(UserRole.PANDIT),
      employees: roleCount(UserRole.EMPLOYEE),
      admins: roleCount(UserRole.ADMIN) + roleCount(UserRole.SUPER_ADMIN),
    },
    pandits: { ...panditStatusCounts, total: panditTotal },
    consultations: {
      scheduled: consultationCount(ConsultationStatus.REQUESTED) + consultationCount(ConsultationStatus.CONFIRMED),
      inProgress: consultationCount(ConsultationStatus.IN_PROGRESS),
      completed: consultationCount(ConsultationStatus.COMPLETED),
      cancelled: consultationCount(ConsultationStatus.CANCELLED),
      noShow: consultationCount(ConsultationStatus.NO_SHOW),
      byMode: modeCounts,
      completedThisMonth,
    },
    revenue: {
      grossPaise: earningTotals._sum.grossAmountPaise ?? 0,
      platformCommissionPaise: earningTotals._sum.platformCommissionPaise ?? 0,
      panditEarningsPaise: earningTotals._sum.netPayablePaise ?? 0,
      pendingPayoutPaise: earningNet(EarningStatus.PENDING) + earningNet(EarningStatus.ELIGIBLE),
      processingPayoutPaise: payoutSum(PayoutStatus.PROCESSING),
      paidPayoutPaise: payoutSum(PayoutStatus.PAID),
      failedPayoutCount: payoutCount(PayoutStatus.FAILED),
      productRevenuePaise: productRevenue._sum.totalPaise ?? 0,
      reportRevenuePaise: reportRevenue._sum.priceSnapshot ?? 0,
    },
    reports: {
      orders: reportOrderTotal,
      ready: reportCount(ReportStatus.READY),
      failed: reportCount(ReportStatus.FAILED),
      inProgress:
        reportCount(ReportStatus.QUEUED) +
        reportCount(ReportStatus.CALCULATING) +
        reportCount(ReportStatus.INTERPRETING) +
        reportCount(ReportStatus.RENDERING),
    },
    commerce: {
      paidOrders,
      pendingFulfilment,
      gemstoneOrders: gemstoneOrderItems.length,
      activeGemstones,
      lowStock: inventoryCount(InventoryStatus.LOW_STOCK),
      outOfStock: inventoryCount(InventoryStatus.OUT_OF_STOCK),
    },
    tickets: {
      ...ticketCounts,
      backlog: ticketCounts[TicketStatus.OPEN] + ticketCounts[TicketStatus.IN_PROGRESS],
    },
    generatedAt: now,
  };
}

/**
 * The smaller set an operations overview needs.
 *
 * A separate query rather than the full analytics object, because the overview
 * is the most-loaded page in the admin and there is no reason for it to compute
 * twenty aggregates it will not render.
 */
export async function getOperationsSummary(now: Date = new Date()) {
  const [
    pendingApplications,
    verificationQueue,
    activePandits,
    todaysConsultations,
    openTickets,
    eligibleEarnings,
    failedPayouts,
    lowStock,
    failedReports,
  ] = await Promise.all([
    prisma.panditProfile.count({ where: { status: PanditOnboardingStatus.SUBMITTED } }),
    prisma.panditProfile.count({
      where: {
        status: {
          in: [
            PanditOnboardingStatus.SUBMITTED,
            PanditOnboardingStatus.UNDER_REVIEW,
            PanditOnboardingStatus.VERIFIED,
          ],
        },
      },
    }),
    prisma.panditProfile.count({ where: { status: PanditOnboardingStatus.ACTIVE } }),
    prisma.consultation.count({
      where: {
        scheduledStart: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        },
      },
    }),
    prisma.ticket.count({ where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] } } }),
    prisma.earningTransaction.aggregate({
      where: { status: EarningStatus.ELIGIBLE },
      _sum: { netPayablePaise: true },
    }),
    prisma.payout.count({ where: { status: PayoutStatus.FAILED } }),
    prisma.inventory.count({
      where: { status: { in: [InventoryStatus.LOW_STOCK, InventoryStatus.OUT_OF_STOCK] } },
    }),
    prisma.generatedReport.count({ where: { status: ReportStatus.FAILED } }),
  ]);

  return {
    pendingApplications,
    verificationQueue,
    activePandits,
    todaysConsultations,
    openTickets,
    eligibleEarningsPaise: eligibleEarnings._sum.netPayablePaise ?? 0,
    failedPayouts,
    lowStock,
    failedReports,
  };
}
