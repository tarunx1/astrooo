import type { Metadata } from "next";
import { AdminLayout, AdminSection } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { ProductForm } from "@/components/admin/product-form";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const admin = await requireAdmin();

  return (
    <AdminLayout
      adminName={admin.name || admin.email}
      currentPath="/admin/products"
      description="New products start hidden and with zero stock until you adjust them."
      title="New product"
    >
      <AdminSection>
        <Card className="p-5 sm:p-6">
          <ProductForm />
        </Card>
      </AdminSection>
    </AdminLayout>
  );
}
