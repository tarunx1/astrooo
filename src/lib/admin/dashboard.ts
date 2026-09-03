import "server-only";

import { OrderStatus, ProductType, ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { LOW_STOCK_THRESHOLD } from "@/lib/admin/inventory";

/**
 * Operational dashboard counts.
 *
 * Every figure is a direct count of a real row. There are no derived analytics,
 * no estimates and no revenue projections; the one money figure is a sum of
 * captured payments and is labelled as such.
 */
export type DashboardMetrics = {
  ordersAwaitingProcessing: number;
  ordersProcessing: number;
  ordersShipped: number;
  paidPhysicalOrders: number;
  lowStockCount: number;
  outOfStockCount: number;
  activeProducts: number;
  paidReportOrders: number;
  reportsGenerating: number;
  reportsReady: number;
  reportFailures: number;
  activeReportDefinitions: number;
  capturedRevenuePaise: number;
  lowStockThreshold: number;
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [
    ordersAwaitingProcessing,
    ordersProcessing,
    ordersShipped,
    paidPhysicalOrders,
    lowStockCount,
    outOfStockCount,
    activeProducts,
    paidReportOrders,
    reportsGenerating,
    reportsReady,
    reportFailures,
    activeReportDefinitions,
    capturedRevenue,
  ] = await Promise.all([
    prisma.order.count({ where: { status: OrderStatus.PAID } }),
    prisma.order.count({ where: { status: OrderStatus.PROCESSING } }),
    prisma.order.count({ where: { status: OrderStatus.SHIPPED } }),
    prisma.order.count({ where: { paidAt: { not: null } } }),
    prisma.inventory.count({ where: { quantity: { gt: 0, lte: LOW_STOCK_THRESHOLD } } }),
    prisma.inventory.count({ where: { quantity: { lte: 0 } } }),
    prisma.product.count({ where: { active: true, type: ProductType.PHYSICAL } }),
    prisma.reportOrder.count({ where: { paidAt: { not: null } } }),
    prisma.generatedReport.count({
      where: { status: { in: [ReportStatus.QUEUED, ReportStatus.INTERPRETING, ReportStatus.RENDERING] } },
    }),
    prisma.generatedReport.count({ where: { status: ReportStatus.READY } }),
    prisma.generatedReport.count({ where: { status: ReportStatus.FAILED } }),
    prisma.reportDefinition.count({ where: { isActive: true } }),
    // Only genuinely captured payments are summed. Nothing is inferred.
    prisma.payment.aggregate({ _sum: { amountPaise: true }, where: { status: "CAPTURED" } }),
  ]);

  return {
    ordersAwaitingProcessing,
    ordersProcessing,
    ordersShipped,
    paidPhysicalOrders,
    lowStockCount,
    outOfStockCount,
    activeProducts,
    paidReportOrders,
    reportsGenerating,
    reportsReady,
    reportFailures,
    activeReportDefinitions,
    capturedRevenuePaise: capturedRevenue._sum.amountPaise ?? 0,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
  };
}
