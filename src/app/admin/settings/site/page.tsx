import type { Metadata } from "next";
import { AdminLayout } from "@/components/admin/admin-shell";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { getSettings } from "@/lib/settings/service";
import { SiteSettingsClient } from "@/app/admin/settings/site/settings-client";

export const metadata: Metadata = { title: "Site settings" };
export const dynamic = "force-dynamic";

export default async function AdminSiteSettingsPage() {
  const admin = await requireSuperAdmin();

  const values = await getSettings([
    "site.name",
    "site.legalName",
    "site.supportEmail",
    "site.contactPhone",
    "site.contactAddress",
    "site.announcement",
  ]);

  return (
    <AdminLayout
      adminName={admin.name || admin.email}
      currentPath="/admin/settings/site"
      description="Identity and contact details used across the public site."
      title="Site"
    >
      <SiteSettingsClient
        values={{
          name: values["site.name"],
          legalName: values["site.legalName"],
          supportEmail: values["site.supportEmail"],
          contactPhone: values["site.contactPhone"],
          contactAddress: values["site.contactAddress"],
          announcement: values["site.announcement"],
        }}
      />
    </AdminLayout>
  );
}
