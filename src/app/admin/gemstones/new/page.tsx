import type { Metadata } from "next";
import { AdminLayout } from "@/components/admin/admin-shell";
import { GemstoneForm } from "@/components/admin/gemstone-form";
import { requirePermission } from "@/lib/auth/access";
import { Card } from "@/components/ui/card";

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
      <Card className="max-w-3xl" padding="md" variant="admin">
        <GemstoneForm />
      </Card>
    </AdminLayout>
  );
}
