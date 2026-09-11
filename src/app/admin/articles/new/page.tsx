import type { Metadata } from "next";
import { AdminLayout } from "@/components/admin/admin-shell";
import { ArticleForm } from "@/components/admin/article-form";
import { requirePermission } from "@/lib/auth/access";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "New article" };

export default async function NewArticlePage() {
  const viewer = await requirePermission("reports.manage");

  const categories = await prisma.articleCategory.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/articles"
      description="Created as a draft. Publishing is a separate step."
      title="New article"
    >
      <div className="max-w-3xl rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <ArticleForm categories={categories} />
      </div>
    </AdminLayout>
  );
}
