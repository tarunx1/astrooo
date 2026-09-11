import type { Metadata } from "next";
import { ReportStatus } from "@prisma/client";
import { EmployeeLayout } from "@/components/employee/employee-shell";
import { DataTable, FilterBar, MetricCard, MetricGrid, Pagination, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { requirePermission } from "@/lib/auth/access";
import { categoriseFailure, listGeneratedReports } from "@/lib/admin/catalog-admin";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Reports" };

const PAGE_SIZE = 25;

/**
 * Generated report health.
 *
 * Failure reasons are shown as coarse categories rather than raw provider
 * strings: the underlying message can carry provider detail that does not
 * belong in an operations screen.
 */
export default async function EmployeeReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  await requirePermission("reports.view");
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const status =
    params.status && params.status in ReportStatus ? (params.status as ReportStatus) : undefined;

  const [{ rows, total }, failed, ready] = await Promise.all([
    listGeneratedReports({ page, pageSize: PAGE_SIZE, status }),
    prisma.generatedReport.count({ where: { status: ReportStatus.FAILED } }),
    prisma.generatedReport.count({ where: { status: ReportStatus.READY } }),
  ]);

  return (
    <EmployeeLayout
      currentPath="/employee/reports"
      description="Generated reports and anything that needs looking at."
      eyebrow="Reports"
      title="Reports"
    >
      <MetricGrid>
        <MetricCard label="Ready" value={ready} />
        <MetricCard label="Failed" tone={failed > 0 ? "danger" : undefined} value={failed} />
      </MetricGrid>

      <FilterBar
        basePath="/employee/reports"
        current={status}
        options={[
          { label: "All", value: undefined },
          { label: "Failed", value: ReportStatus.FAILED },
          { label: "Ready", value: ReportStatus.READY },
          { label: "Queued", value: ReportStatus.QUEUED },
        ]}
      />

      <DataTable
        caption="Generated reports"
        columns={[
          { key: "report", label: "Report" },
          { key: "status", label: "Status" },
          { key: "attempts", label: "Attempts", align: "right" },
          { key: "issue", label: "Issue" },
          { key: "created", label: "Created" },
        ]}
        emptyMessage="No reports match that filter."
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-1.5">
            <p className="body-sm font-semibold text-slate-900">{row.reportOrder.reportNameSnapshot}</p>
            <StatusBadge label={row.status} tone={row.status === ReportStatus.FAILED ? "danger" : "neutral"} />
            <p className="caption text-slate-500">{categoriseFailure(row.lastErrorCategory) ?? "—"}</p>
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "report":
              return (
                <span className="grid">
                  <span className="font-semibold text-slate-800">{row.reportOrder.reportNameSnapshot}</span>
                  <span className="caption text-slate-500">{row.reportOrder.user.email}</span>
                </span>
              );
            case "status":
              return (
                <StatusBadge
                  label={row.status}
                  tone={row.status === ReportStatus.FAILED ? "danger" : row.status === ReportStatus.READY ? "positive" : "neutral"}
                />
              );
            case "attempts":
              return row.attemptCount;
            case "issue":
              return categoriseFailure(row.lastErrorCategory) ?? "—";
            default:
              return row.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
          }
        }}
        rows={rows}
      />

      <Pagination basePath="/employee/reports" page={page} pageSize={PAGE_SIZE} query={{ status }} total={total} />
    </EmployeeLayout>
  );
}
