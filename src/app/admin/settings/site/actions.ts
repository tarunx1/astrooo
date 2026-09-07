"use server";

import { saveSettingsGroup } from "@/app/admin/settings/actions";
import type { AdminActionState } from "@/lib/admin/action-state";
import type { SettingKey } from "@/lib/settings/registry";

/**
 * The keys this page may write.
 *
 * Declared on the server, not sent by the browser, so a crafted form cannot
 * reach a setting belonging to another category.
 */
const SITE_KEYS = [
  "site.name",
  "site.legalName",
  "site.supportEmail",
  "site.contactPhone",
  "site.contactAddress",
  "site.announcement",
] as const satisfies readonly SettingKey[];

export async function saveSiteSettingsAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  // The footer and contact surfaces read these, so the public pages are
  // revalidated too rather than only the admin screen.
  return saveSettingsGroup(SITE_KEYS, formData, ["/", "/admin/settings/site"]);
}
