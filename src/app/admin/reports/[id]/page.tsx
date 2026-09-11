import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminLayout, AdminSection } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { ReportDefinitionForm } from "@/components/admin/report-definition-form";
import { requireAdmin } from "@/lib/auth/admin";
import { getReportDefinition } from "@/lib/admin/catalog-admin";

export const metadata: Metadata = { title: "Report" };

export default async function AdminReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;

  const definition = await getReportDefinition(id);
  if (!definition) notFound();

  const sections = Array.isArray(definition.sectionsIncluded)
    ? (definition.sectionsIncluded as unknown[]).filter((value): value is string => typeof value === "string")
    : [];

  return (
    <AdminLayout
      adminName={admin.name || admin.email}
      currentPath="/admin/reports"
      description={definition.slug}
      title={definition.name}
    >
      <AdminSection>
        <Card className="p-5 sm:p-6" variant="admin">
          <ReportDefinitionForm
            initial={{
              id: definition.id,
              name: definition.name,
              shortDescription: definition.shortDescription,
              description: definition.description,
              priceRupees: (definition.priceMinor / 100).toString(),
              estimatedPages: String(definition.estimatedPages),
              sortOrder: String(definition.sortOrder),
              isActive: definition.isActive,
              sections: sections.join("\n"),
            }}
          />
        </Card>
      </AdminSection>

      <AdminSection title="Before activating">
        <Card className="p-5" variant="admin">
          <p className="body-sm text-slate-600">
            A report should only go on sale once its generation pipeline can actually produce it. The Numerology
            report is deliberately inactive: the calculator exists but the interpretive content the report needs does
            not. Activating it here would put an unfulfillable product on sale.
          </p>
        </Card>
      </AdminSection>
    </AdminLayout>
  );
}
