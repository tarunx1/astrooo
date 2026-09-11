import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleStatus } from "@prisma/client";
import { AdminLayout } from "@/components/admin/admin-shell";
import { DashboardSection, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { ArticleForm, ArticleStatusControls, type ArticleFormValues } from "@/components/admin/article-form";
import { requirePermission } from "@/lib/auth/access";
import { getArticleForAdmin } from "@/lib/content/articles";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Article" };

const TONE = {
  [ArticleStatus.DRAFT]: "warning",
  [ArticleStatus.PUBLISHED]: "positive",
  [ArticleStatus.ARCHIVED]: "neutral",
} as const;

export default async function AdminArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePermission("reports.manage");
  const { id } = await params;

  const [article, categories] = await Promise.all([
    getArticleForAdmin(id),
    prisma.articleCategory.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  if (!article) notFound();

  const initial: ArticleFormValues = {
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt ?? "",
    content: article.content,
    coverImageUrl: article.coverImageUrl ?? "",
    authorName: article.authorName ?? "",
    articleCategoryId: article.articleCategoryId ?? "",
    tags: article.tags.join(", "),
    seoTitle: article.seoTitle ?? "",
    seoDescription: article.seoDescription ?? "",
  };

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/articles"
      description={article.slug}
      title={article.title}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <DashboardSection title="Content">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <ArticleForm categories={categories} initial={initial} />
          </div>
        </DashboardSection>

        <div className="grid gap-4 self-start">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <p className="caption font-semibold uppercase tracking-wider text-slate-500">Status</p>
            <div className="mt-2">
              <StatusBadge label={article.status} tone={TONE[article.status]} />
            </div>
            {article.publishedAt ? (
              <p className="mt-3 caption text-slate-500">
                First published{" "}
                {article.publishedAt.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            ) : (
              <p className="mt-3 caption text-slate-500">Never published.</p>
            )}

            {article.status === ArticleStatus.PUBLISHED ? (
              <Link
                className="mt-3 inline-block text-sm font-semibold text-blue-700 underline"
                href={`/articles/${article.slug}`}
                prefetch={false}
                target="_blank"
              >
                View live
              </Link>
            ) : null}
          </div>

          <DashboardSection title="Publishing">
            <ArticleStatusControls articleId={article.id} status={article.status} />
          </DashboardSection>
        </div>
      </div>
    </AdminLayout>
  );
}
