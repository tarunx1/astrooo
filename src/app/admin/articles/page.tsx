import type { Metadata } from "next";
import Link from "next/link";
import { ArticleStatus } from "@prisma/client";
import { AdminLayout } from "@/components/admin/admin-shell";
import { DataTable, FilterBar, Pagination, SearchBar, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { requirePermission } from "@/lib/auth/access";
import { listArticlesForAdmin } from "@/lib/content/articles";

export const metadata: Metadata = { title: "Articles" };

const PAGE_SIZE = 25;

const TONE = {
  [ArticleStatus.DRAFT]: "warning",
  [ArticleStatus.PUBLISHED]: "positive",
  [ArticleStatus.ARCHIVED]: "neutral",
} as const;

/** Editorial listing. Unlike every public query, this one includes drafts. */
export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const viewer = await requirePermission("reports.manage");
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const search = params.q?.trim() || undefined;
  const status =
    params.status && params.status in ArticleStatus ? (params.status as ArticleStatus) : undefined;

  const { rows, total } = await listArticlesForAdmin({ page, pageSize: PAGE_SIZE, search, status });

  return (
    <AdminLayout
      actions={
        <Link
          className="min-h-10 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          href="/admin/articles/new"
        >
          New article
        </Link>
      }
      adminName={viewer.name || viewer.email}
      currentPath="/admin/articles"
      description="Guides and editorial content. Drafts are never public."
      title="Articles"
    >
      <SearchBar action="/admin/articles" defaultValue={search} placeholder="Search by title or slug" />

      <FilterBar
        basePath="/admin/articles"
        current={status}
        options={[
          { label: "All", value: undefined },
          { label: "Draft", value: ArticleStatus.DRAFT },
          { label: "Published", value: ArticleStatus.PUBLISHED },
          { label: "Archived", value: ArticleStatus.ARCHIVED },
        ]}
      />

      <DataTable
        caption="Articles"
        columns={[
          { key: "title", label: "Article" },
          { key: "category", label: "Category" },
          { key: "status", label: "Status" },
          { key: "published", label: "Published" },
          { key: "updated", label: "Updated" },
        ]}
        emptyMessage="No articles match that filter."
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-1.5">
            <Link className="body-sm font-semibold text-blue-700 underline" href={`/admin/articles/${row.id}`}>
              {row.title}
            </Link>
            <p className="caption font-mono text-slate-400">{row.slug}</p>
            <StatusBadge label={row.status} tone={TONE[row.status]} />
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "title":
              return (
                <span className="grid">
                  <Link className="font-semibold text-blue-700 underline" href={`/admin/articles/${row.id}`}>
                    {row.title}
                  </Link>
                  <span className="caption font-mono text-slate-400">{row.slug}</span>
                </span>
              );
            case "category":
              return row.categoryName ?? "—";
            case "status":
              return <StatusBadge label={row.status} tone={TONE[row.status]} />;
            case "published":
              return row.publishedAt
                ? row.publishedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                : "—";
            default:
              return row.updatedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
          }
        }}
        rows={rows}
      />

      <Pagination
        basePath="/admin/articles"
        page={page}
        pageSize={PAGE_SIZE}
        query={{ q: search, status }}
        total={total}
      />
    </AdminLayout>
  );
}
