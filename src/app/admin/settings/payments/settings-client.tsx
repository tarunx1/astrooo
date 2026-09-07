"use client";

import { savePaymentSettingsAction } from "@/app/admin/settings/payments/actions";
import { SecretField } from "@/components/admin/secret-field";
import { SettingsForm } from "@/components/admin/settings-form";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type SecretState = { configured: boolean; source: "admin" | "environment" | "none" };

export function PaymentSettingsClient({
  enabled,
  mode,
  keyId,
  keySecret,
  webhookSecret,
  webhookUrl,
}: {
  enabled: boolean;
  mode: "TEST" | "LIVE";
  keyId: string;
  keySecret: SecretState;
  webhookSecret: SecretState;
  webhookUrl: string;
}) {
  return (
    <div className="grid gap-8">
      <SettingsForm
        action={savePaymentSettingsAction}
        onConfirm="Save payment settings? Switching to LIVE means real cards will be charged."
      >
        <div className="flex items-start gap-3">
          <Checkbox defaultChecked={enabled} id="payments-enabled" name="payments.enabled" />
          <div className="grid gap-1">
            <Label htmlFor="payments-enabled">Accept payments</Label>
            <p className="caption text-foreground-muted">
              Credentials existing is not the same as being switched on. Checkout stays closed until this is
              ticked and the credentials below are complete.
            </p>
          </div>
        </div>

        <FormField
          hint="TEST uses Razorpay's sandbox. LIVE charges real cards."
          id="payments-mode"
          label="Mode"
        >
          <Select defaultValue={mode} id="payments-mode" name="payments.mode">
            <option value="TEST">TEST — sandbox</option>
            <option value="LIVE">LIVE — real payments</option>
          </Select>
        </FormField>

        <FormField
          hint="Publishable. This one is sent to the checkout widget in the browser."
          id="payments-razorpayKeyId"
          label="Razorpay key ID"
        >
          <Input defaultValue={keyId} id="payments-razorpayKeyId" name="payments.razorpayKeyId" />
        </FormField>
      </SettingsForm>

      <section aria-labelledby="credentials-heading" className="grid gap-4">
        <div>
          <h2 className="heading-sm" id="credentials-heading">
            Credentials
          </h2>
          <p className="mt-1 body-sm text-foreground-secondary">
            Stored encrypted. Once saved a value cannot be read back here, only replaced or removed.
          </p>
        </div>

        <SecretField
          configured={keySecret.configured}
          label="Key secret"
          secretKey="payments.razorpayKeySecret"
          source={keySecret.source}
        />

        <SecretField
          configured={webhookSecret.configured}
          hint="Used to verify that a webhook really came from Razorpay."
          label="Webhook secret"
          secretKey="payments.razorpayWebhookSecret"
          source={webhookSecret.source}
        />

        <div className="rounded-lg border border-border p-4">
          <p className="body-sm font-semibold text-foreground">Webhook endpoint</p>
          <p className="mt-1 break-all caption text-foreground-muted">{webhookUrl}</p>
          <p className="mt-2 caption text-foreground-muted">
            Register this URL in the Razorpay dashboard and use the same webhook secret above.
          </p>
        </div>
      </section>
    </div>
  );
}
