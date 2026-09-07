import type { Metadata } from "next";
import { AdminLayout } from "@/components/admin/admin-shell";
import { brand } from "@/config/brand";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { describeSecret, getSettings } from "@/lib/settings/service";
import { PaymentSettingsClient } from "@/app/admin/settings/payments/settings-client";

export const metadata: Metadata = { title: "Payment settings" };
export const dynamic = "force-dynamic";

export default async function AdminPaymentSettingsPage() {
  const admin = await requireSuperAdmin();

  // Only presence and provenance cross to the browser, never a stored value.
  const [values, keySecret, webhookSecret] = await Promise.all([
    getSettings(["payments.enabled", "payments.mode", "payments.razorpayKeyId"]),
    describeSecret("payments.razorpayKeySecret"),
    describeSecret("payments.razorpayWebhookSecret"),
  ]);

  return (
    <AdminLayout
      adminName={admin.name || admin.email}
      currentPath="/admin/settings/payments"
      description="Razorpay credentials and whether payments are accepted."
      title="Payments"
    >
      <PaymentSettingsClient
        enabled={values["payments.enabled"]}
        keyId={values["payments.razorpayKeyId"]}
        keySecret={{ configured: keySecret.configured, source: keySecret.source }}
        mode={values["payments.mode"]}
        webhookSecret={{ configured: webhookSecret.configured, source: webhookSecret.source }}
        webhookUrl={`${brand.url}/api/webhooks/razorpay`}
      />
    </AdminLayout>
  );
}
