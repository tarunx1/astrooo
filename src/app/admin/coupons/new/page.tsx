import type { Metadata } from "next";
import { AdminLayout, AdminSection } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { CouponForm } from "@/components/admin/coupon-form";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "New coupon" };

export default async function NewCouponPage() {
  const admin = await requireAdmin();

  return (
    <AdminLayout adminName={admin.name || admin.email} currentPath="/admin/coupons" title="New coupon">
      <AdminSection>
        <Card className="p-5 sm:p-6">
          <CouponForm />
        </Card>
      </AdminSection>
    </AdminLayout>
  );
}
