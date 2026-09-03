import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminLayout, AdminSection } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { CouponForm } from "@/components/admin/coupon-form";
import { requireAdmin } from "@/lib/auth/admin";
import { getCoupon } from "@/lib/admin/catalog-admin";

export const metadata: Metadata = { title: "Coupon" };

function toRupees(paise: number | null): string {
  return paise == null ? "" : (paise / 100).toString();
}

function toDateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function AdminCouponDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;

  const coupon = await getCoupon(id);
  if (!coupon) notFound();

  return (
    <AdminLayout adminName={admin.name || admin.email} currentPath="/admin/coupons" title={coupon.code}>
      <AdminSection>
        <Card className="p-5 sm:p-6">
          <CouponForm
            initial={{
              id: coupon.id,
              code: coupon.code,
              description: coupon.description ?? "",
              percentOff: coupon.percentOff?.toString() ?? "",
              amountOffRupees: toRupees(coupon.amountOffPaise),
              minOrderRupees: toRupees(coupon.minOrderPaise),
              maxDiscountRupees: toRupees(coupon.maxDiscountPaise),
              usageLimit: coupon.usageLimit?.toString() ?? "",
              perUserLimit: coupon.perUserLimit?.toString() ?? "",
              startsAt: toDateInput(coupon.startsAt),
              endsAt: toDateInput(coupon.endsAt),
              active: coupon.active,
              timesRedeemed: coupon.timesRedeemed,
            }}
          />
        </Card>
      </AdminSection>
    </AdminLayout>
  );
}
