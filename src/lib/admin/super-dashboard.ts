import "server-only";

import { ConsultationStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getOperationsSummary, getPlatformAnalytics } from "@/lib/analytics/platform";
import { getUserGeography } from "@/lib/analytics/geography.server";
import type { GeographySummary } from "@/lib/analytics/geography";

export type SuperDashboardMetricId = "accounts" | "consultations" | "orders" | "reports";

export type SuperDashboardMetric = {
  id: SuperDashboardMetricId;
  label: string;
  value: number;
  changePercent: number | null;
  points: Array<{ date: string; label: string; value: number }>;
};

export type SuperAdminDashboardData = {
  generatedAt: string;
  metrics: SuperDashboardMetric[];
  liveUsers: number;
  totalAccounts: number;
  newAccountsThisMonth: number;
  queues: Array<{ label: string; value: number; href: string }>;
  userRoles: Array<{ label: string; value: number }>;
  liveRoles: Array<{ label: string; value: number }>;
  recentAccounts: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
  }>;
  geography: GeographySummary | null;
  geographyError: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function roleLabel(role: UserRole) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildDailySeries(dates: Date[], now: Date) {
  const today = startOfDay(now);
  const days = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(today.getTime() - (7 - index) * DAY_MS);
    return {
      date: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      value: 0,
    };
  });
  const byDate = new Map(days.map((day) => [day.date, day]));

  for (const date of dates) {
    const key = startOfDay(date).toISOString().slice(0, 10);
    const point = byDate.get(key);
    if (point) point.value += 1;
  }

  return days;
}

function periodChange(dates: Date[], now: Date) {
  const today = startOfDay(now);
  const currentStart = new Date(today.getTime() - 6 * DAY_MS);
  const previousStart = new Date(currentStart.getTime() - 7 * DAY_MS);
  const current = dates.filter((date) => date >= currentStart).length;
  const previous = dates.filter((date) => date >= previousStart && date < currentStart).length;

  if (previous === 0) return { value: current, changePercent: null };
  return { value: current, changePercent: Math.round(((current - previous) / previous) * 1000) / 10 };
}

/**
 * The data contract for the Super Admin landing screen.
 *
 * The reference design contains web-analytics fields the product does not
 * record (page views, bounce rate and geographic presence). This contract only
 * exposes facts that exist in our database, while preserving the same dashboard
 * anatomy in the UI.
 */
export async function getSuperAdminDashboardData(now: Date = new Date()): Promise<SuperAdminDashboardData> {
  const today = startOfDay(now);
  const historyStart = new Date(today.getTime() - 13 * DAY_MS);

  const [
    analytics,
    operations,
    accountRows,
    consultationRows,
    orderRows,
    reportRows,
    recentAccounts,
    liveSessions,
    geographyResult,
  ] = await Promise.all([
    getPlatformAnalytics(now),
    getOperationsSummary(now),
    prisma.user.findMany({ where: { createdAt: { gte: historyStart } }, select: { createdAt: true } }),
    prisma.consultation.findMany({
      where: { status: ConsultationStatus.COMPLETED, completedAt: { gte: historyStart } },
      select: { completedAt: true },
    }),
    prisma.order.findMany({ where: { paidAt: { gte: historyStart } }, select: { paidAt: true } }),
    prisma.reportOrder.findMany({ where: { paidAt: { gte: historyStart } }, select: { paidAt: true } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    prisma.session.findMany({
      where: { expiresAt: { gt: now } },
      distinct: ["userId"],
      select: { user: { select: { role: true } } },
    }),
    getUserGeography()
      .then((geography) => ({ geography, error: false as const }))
      .catch(() => ({ geography: null, error: true as const })),
  ]);

  const metricDates: Array<{
    id: SuperDashboardMetricId;
    label: string;
    dates: Date[];
  }> = [
    { id: "accounts", label: "New Accounts", dates: accountRows.map((row) => row.createdAt) },
    {
      id: "consultations",
      label: "Completed Consultations",
      dates: consultationRows.flatMap((row) => (row.completedAt ? [row.completedAt] : [])),
    },
    { id: "orders", label: "Paid Product Orders", dates: orderRows.flatMap((row) => (row.paidAt ? [row.paidAt] : [])) },
    { id: "reports", label: "Paid Report Orders", dates: reportRows.flatMap((row) => (row.paidAt ? [row.paidAt] : [])) },
  ];

  const liveRoleCounts = new Map<UserRole, number>();
  for (const session of liveSessions) {
    const role = session.user.role;
    liveRoleCounts.set(role, (liveRoleCounts.get(role) ?? 0) + 1);
  }

  return {
    generatedAt: now.toISOString(),
    metrics: metricDates.map((metric) => ({
      id: metric.id,
      label: metric.label,
      ...periodChange(metric.dates, now),
      points: buildDailySeries(metric.dates, now),
    })),
    liveUsers: analytics.users.withLiveSession,
    totalAccounts: analytics.users.total,
    newAccountsThisMonth: analytics.users.newThisMonth,
    queues: [
      { label: "Pandit verification", value: operations.verificationQueue, href: "/admin/pandits/verification" },
      { label: "Pending fulfilment", value: analytics.commerce.pendingFulfilment, href: "/admin/orders" },
      { label: "Support backlog", value: analytics.tickets.backlog, href: "/admin/tickets" },
      { label: "Failed reports", value: operations.failedReports, href: "/admin/generated-reports?status=FAILED" },
    ],
    userRoles: [
      { label: "Customers", value: analytics.users.customers },
      { label: "Pandits", value: analytics.users.pandits },
      { label: "Employees", value: analytics.users.employees },
      { label: "Administrators", value: analytics.users.admins },
    ],
    liveRoles: Object.values(UserRole).map((role) => ({
      label: roleLabel(role),
      value: liveRoleCounts.get(role) ?? 0,
    })),
    recentAccounts: recentAccounts.map((account) => ({
      ...account,
      role: roleLabel(account.role),
      createdAt: account.createdAt.toISOString(),
    })),
    geography: geographyResult.geography,
    geographyError: geographyResult.error,
  };
}
