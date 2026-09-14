import type { Metadata } from "next";
import { AdminLayout } from "@/components/admin/admin-shell";
import { ArticleForm } from "@/components/admin/article-form";
import { requirePermission } from "@/lib/auth/access";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/card";

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
      <Card className="max-w-3xl" padding="md" variant="admin">
        <ArticleForm categories={categories} />
      </Card>
    </AdminLayout>
  );
}
