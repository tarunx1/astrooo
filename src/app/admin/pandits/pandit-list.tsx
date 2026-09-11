import Link from "next/link";
import { PanditOnboardingStatus } from "@prisma/client";
import { DataTable, FilterBar, Pagination, SearchBar, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/pandit/onboarding";
import type { PanditListRow } from "@/lib/pandit/queries";

/**
 * The Pandit table.
 *
 * Shared between the admin and employee areas and between the three listing
 * views, with `basePath` deciding where a row links. One table means one set of
 * columns to keep correct.
 */
export function PanditList({
  rows,
  total,
  page,
  pageSize,
  basePath,
  search,
  status,
  showFilters = true,
}: {
  rows: PanditListRow[];
  total: number;
  page: number;
  pageSize: number;
  basePath: string;
  search?: string;
  status?: PanditOnboardingStatus;
  showFilters?: boolean;
}) {
  return (
    <>
      <SearchBar action={basePath} defaultValue={search} placeholder="Search by name or email" />

      {showFilters ? (
        <FilterBar
          basePath={basePath}
          current={status}
          options={[
            { label: "All", value: undefined },
            { label: "Submitted", value: PanditOnboardingStatus.SUBMITTED },
            { label: "Under review", value: PanditOnboardingStatus.UNDER_REVIEW },
            { label: "Changes requested", value: PanditOnboardingStatus.CHANGES_REQUESTED },
            { label: "Verified", value: PanditOnboardingStatus.VERIFIED },
            { label: "Active", value: PanditOnboardingStatus.ACTIVE },
            { label: "Suspended", value: PanditOnboardingStatus.SUSPENDED },
          ]}
        />
      ) : null}

      <DataTable
        caption="Pandits"
        columns={[
          { key: "applicant", label: "Applicant" },
          { key: "status", label: "Status" },
          { key: "expertise", label: "Specialisations" },
          { key: "location", label: "Location" },
          { key: "documents", label: "Docs", align: "right" },
          { key: "waiting", label: "Waiting since" },
        ]}
        emptyMessage="No applications match that filter."
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-1.5">
            <Link className="body-sm font-semibold text-blue-700 underline" href={`${basePath}/${row.id}`}>
              {row.displayName || row.email}
            </Link>
            <p className="caption text-slate-500">{row.email}</p>
            <StatusBadge label={STATUS_LABEL[row.status]} tone={STATUS_TONE[row.status]} />
            <p className="caption text-slate-500">
              {row.expertise.slice(0, 3).join(", ") || "No specialisations"}
            </p>
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "applicant":
              return (
                <span className="grid">
                  <Link className="font-semibold text-blue-700 underline" href={`${basePath}/${row.id}`}>
                    {row.displayName || "Unnamed"}
                  </Link>
                  <span className="caption text-slate-500">{row.email}</span>
                </span>
              );
            case "status":
              return <StatusBadge label={STATUS_LABEL[row.status]} tone={STATUS_TONE[row.status]} />;
            case "expertise":
              return row.expertise.slice(0, 3).join(", ") || "—";
            case "location":
              return [row.city, row.state].filter(Boolean).join(", ") || "—";
            case "documents":
              return row.documentCount;
            default:
              return (row.submittedAt ?? row.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
          }
        }}
        rows={rows}
      />

      <Pagination
        basePath={basePath}
        page={page}
        pageSize={pageSize}
        query={{ q: search, status }}
        total={total}
      />
    </>
  );
}
