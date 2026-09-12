import type { Metadata } from "next";
import Link from "next/link";
import { ReportStatus } from "@prisma/client";
import { AdminLayout, AdminPagination, AdminStatusBadge, AdminTable } from "@/components/admin/admin-shell";
import { RetryReportForm } from "@/components/admin/retry-report-form";
import { categoriseFailure, listGeneratedReports } from "@/lib/admin/catalog-admin";
import { requirePermission } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Generated reports" };

const PAGE_SIZE = 25;

export default async function AdminGeneratedReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const admin = await requirePermission("reports.view");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const status = Object.values(ReportStatus).includes(params.status as ReportStatus)
    ? (params.status as ReportStatus)
    : undefined;

  const { rows, total } = await listGeneratedReports({ page, pageSize: PAGE_SIZE, status });

  return (
    <AdminLayout
      adminName={admin.name || admin.email}
      currentPath="/admin/generated-reports"
      description="Failure reasons are shown as categories. Prompts and raw provider payloads are never displayed here."
      title="Generated reports"
    >
      <div className="flex flex-wrap gap-2">
        {[undefined, ReportStatus.QUEUED, ReportStatus.RENDERING, ReportStatus.READY, ReportStatus.FAILED].map((value) => (
          <Link
            className={`min-h-9 rounded-md border px-3 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              status === value
                ? "border-slate-900 bg-slate-900 text-white shadow-xs"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            }`}
            href={value ? `/admin/generated-reports?status=${value}` : "/admin/generated-reports"}
            key={value ?? "all"}
            prefetch={false}
          >
            {value ?? "All"}
          </Link>
        ))}
      </div>

      <AdminTable
        caption="Generated reports"
        columns={[
          { key: "report", label: "Report" },
          { key: "status", label: "Status" },
          { key: "attempts", label: "Attempts", align: "right" },
          { key: "engine", label: "Engine" },
          { key: "actions", label: "", align: "right" },
        ]}
        emptyMessage="No generated reports match."
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-2">
            <p className="body-sm font-semibold text-foreground">{row.reportOrder.reportNameSnapshot}</p>
            <p className="caption text-foreground-muted">{row.reportOrder.user.email}</p>
            <AdminStatusBadge
              label={row.status}
              tone={row.status === "FAILED" ? "danger" : row.status === "READY" ? "positive" : "info"}
            />
            {categoriseFailure(row.lastErrorCategory) ? (
              <p className="caption text-danger">{categoriseFailure(row.lastErrorCategory)}</p>
            ) : null}
            {row.status === "FAILED" ? <RetryReportForm generatedReportId={row.id} /> : null}
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "report":
              return (
                <span className="grid">
                  <span className="font-semibold text-foreground">{row.reportOrder.reportNameSnapshot}</span>
                  <span className="caption text-foreground-muted">{row.reportOrder.user.email}</span>
                </span>
              );
            case "status":
              return (
                <span className="grid gap-1">
                  <AdminStatusBadge
                    label={row.status}
                    tone={row.status === "FAILED" ? "danger" : row.status === "READY" ? "positive" : "info"}
                  />
                  {categoriseFailure(row.lastErrorCategory) ? (
                    <span className="caption text-danger">{categoriseFailure(row.lastErrorCategory)}</span>
                  ) : null}
                </span>
              );
            case "attempts":
              return row.attemptCount;
            case "engine":
              return row.aiProvider ? `${row.aiProvider}/${row.aiModel ?? "?"}` : "—";
            default:
              return row.status === "FAILED" ? <RetryReportForm generatedReportId={row.id} /> : null;
          }
        }}
        rows={rows}
      />

      <AdminPagination basePath="/admin/generated-reports" page={page} pageSize={PAGE_SIZE} query={{ status }} total={total} />
    </AdminLayout>
  );
}
