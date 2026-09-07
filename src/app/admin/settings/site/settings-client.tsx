"use client";

import { SettingsForm } from "@/components/admin/settings-form";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveSiteSettingsAction } from "@/app/admin/settings/site/actions";

/**
 * Site identity and contact details.
 *
 * Every field here is consumed somewhere on the public site; nothing is stored
 * that nothing reads.
 */
export function SiteSettingsClient({
  values,
}: {
  values: {
    name: string;
    legalName: string;
    supportEmail: string;
    contactPhone: string;
    contactAddress: string;
    announcement: string;
  };
}) {
  return (
    <SettingsForm action={saveSiteSettingsAction}>
      <FormField hint="Used in the footer and page titles." id="site-name" label="Site name">
        <Input defaultValue={values.name} id="site-name" name="site.name" required />
      </FormField>

      <FormField hint="Shown in the footer where a registered name is expected." id="site-legalName" label="Legal or business name">
        <Input defaultValue={values.legalName} id="site-legalName" name="site.legalName" />
      </FormField>

      <FormField hint="Customers are pointed here for help." id="site-supportEmail" label="Support email">
        <Input defaultValue={values.supportEmail} id="site-supportEmail" name="site.supportEmail" type="email" />
      </FormField>

      <FormField id="site-contactPhone" label="Contact phone">
        <Input defaultValue={values.contactPhone} id="site-contactPhone" name="site.contactPhone" />
      </FormField>

      <FormField id="site-contactAddress" label="Business address">
        <Textarea defaultValue={values.contactAddress} id="site-contactAddress" name="site.contactAddress" rows={3} />
      </FormField>

      <FormField
        hint="Leave empty to hide the banner. Plain text only."
        id="site-announcement"
        label="Announcement banner"
      >
        <Textarea defaultValue={values.announcement} id="site-announcement" name="site.announcement" rows={2} />
      </FormField>
    </SettingsForm>
  );
}
