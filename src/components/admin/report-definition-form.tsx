"use client";

import { AdminField, AdminForm, adminInputClass } from "@/components/admin/admin-form";
import { updateReportDefinitionAction } from "@/app/admin/actions";
import { SmoothInput } from "@/components/ui/smooth-input";

/** The slug is intentionally not editable: orders and prompt specs key on it. */
export function ReportDefinitionForm({
  initial,
}: {
  initial: {
    id: string;
    name: string;
    shortDescription: string;
    description: string;
    priceRupees: string;
    estimatedPages: string;
    sortOrder: string;
    isActive: boolean;
    sections: string;
  };
}) {
  return (
    <AdminForm action={updateReportDefinitionAction} submitLabel="Save report">
      {(state) => (
        <div className="grid gap-4">
          <input name="definitionId" type="hidden" value={initial.id} />

          <AdminField error={state.fieldErrors.name?.[0]} label="Name" name="name">
            <SmoothInput className={adminInputClass} defaultValue={initial.name} id="name" name="name" required />
          </AdminField>

          <AdminField error={state.fieldErrors.shortDescription?.[0]} label="Short description" name="shortDescription">
            <SmoothInput className={adminInputClass} defaultValue={initial.shortDescription} id="shortDescription" name="shortDescription" required />
          </AdminField>

          <AdminField error={state.fieldErrors.description?.[0]} label="Full description" name="description">
            <textarea className={`${adminInputClass} min-h-28`} defaultValue={initial.description} id="description" name="description" required />
          </AdminField>

          <div className="grid gap-4 sm:grid-cols-3">
            <AdminField error={state.fieldErrors.priceMinor?.[0]} hint="In rupees." label="Price" name="price">
              <input className={adminInputClass} defaultValue={initial.priceRupees} id="price" inputMode="decimal" name="price" required step="0.01" type="number" />
            </AdminField>
            <AdminField error={state.fieldErrors.estimatedPages?.[0]} label="Estimated pages" name="estimatedPages">
              <input className={adminInputClass} defaultValue={initial.estimatedPages} id="estimatedPages" name="estimatedPages" required type="number" />
            </AdminField>
            <AdminField error={state.fieldErrors.sortOrder?.[0]} label="Sort order" name="sortOrder">
              <input className={adminInputClass} defaultValue={initial.sortOrder} id="sortOrder" name="sortOrder" required type="number" />
            </AdminField>
          </div>

          <AdminField hint="One section title per line." label="Sections included" name="sectionsIncluded">
            <textarea className={`${adminInputClass} min-h-28`} defaultValue={initial.sections} id="sectionsIncluded" name="sectionsIncluded" />
          </AdminField>

          <label className="flex items-center gap-2 body-sm text-foreground-secondary" htmlFor="isActive">
            <input className="size-4" defaultChecked={initial.isActive} id="isActive" name="isActive" type="checkbox" />
            On sale
          </label>
        </div>
      )}
    </AdminForm>
  );
}
