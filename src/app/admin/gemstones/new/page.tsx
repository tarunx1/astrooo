import type { Metadata } from "next";
import { AdminLayout } from "@/components/admin/admin-shell";
import { GemstoneForm } from "@/components/admin/gemstone-form";
import { requirePermission } from "@/lib/auth/access";

export const metadata: Metadata = { title: "New gemstone" };

export default async function NewGemstonePage() {
  const viewer = await requirePermission("gemstones.manage");

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/gemstones"
      description="New stones start with zero stock. Record an inventory adjustment to put them on sale."
      title="New gemstone"
    >
      <div className="max-w-3xl rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <GemstoneForm />
      </div>
    </AdminLayout>
  );
}
