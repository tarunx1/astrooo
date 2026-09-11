import type { Metadata } from "next";
import Link from "next/link";
import { AccountLayout } from "@/components/account/account-shell";
import { DataTable, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/session";
import { COURSE_LEVEL_LABEL, listEnrolments } from "@/lib/content/courses";

export const metadata: Metadata = {
  title: "My Courses",
  robots: { index: false, follow: false },
};

/**
 * The learner's enrolments.
 *
 * Deliberately shows no progress. This application has no lesson delivery, so
 * there is nothing to measure - a completion percentage here would be invented.
 * When real delivery exists, progress gets a model and this page gets a column.
 */
export default async function AccountCoursesPage() {
  const user = await requireUser("/account/courses");
  const enrolments = await listEnrolments(user.id);

  return (
    <AccountLayout
      currentPath="/account/courses"
      description="Courses you are enrolled in."
      eyebrow="My account"
      title="Courses"
    >
      {enrolments.length === 0 ? (
        <div className="grid gap-4">
          <EmptyState message="You are not enrolled in any courses yet." title="Nothing enrolled" />
          <Link
            className="mx-auto inline-flex min-h-11 items-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            href="/courses"
          >
            Browse courses
          </Link>
        </div>
      ) : (
        <DataTable
          caption="Enrolled courses"
          columns={[
            { key: "course", label: "Course" },
            { key: "level", label: "Level" },
            { key: "modules", label: "Modules", align: "right" },
            { key: "enrolled", label: "Enrolled" },
          ]}
          emptyMessage="Nothing enrolled."
          getKey={(row) => row.id}
          renderCard={(row) => (
            <div className="grid gap-1.5">
              <Link className="body-sm font-semibold text-blue-700 underline" href={`/courses/${row.slug}`}>
                {row.title}
              </Link>
              <StatusBadge label={COURSE_LEVEL_LABEL[row.level]} tone="info" />
              {row.instructorName ? (
                <p className="caption text-slate-500">{row.instructorName}</p>
              ) : null}
            </div>
          )}
          renderCell={(row, key) => {
            switch (key) {
              case "course":
                return (
                  <span className="grid">
                    <Link className="font-semibold text-blue-700 underline" href={`/courses/${row.slug}`}>
                      {row.title}
                    </Link>
                    {row.instructorName ? (
                      <span className="caption text-slate-500">{row.instructorName}</span>
                    ) : null}
                  </span>
                );
              case "level":
                return <StatusBadge label={COURSE_LEVEL_LABEL[row.level]} tone="info" />;
              case "modules":
                return row.moduleCount > 0 ? row.moduleCount : "—";
              default:
                return row.enrolledAt.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
            }
          }}
          rows={enrolments}
        />
      )}
    </AccountLayout>
  );
}
