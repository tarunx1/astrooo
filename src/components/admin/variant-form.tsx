"use client";

import { AdminField, AdminForm, adminInputClass } from "@/components/admin/admin-form";
import { upsertVariantAction } from "@/app/admin/actions";

/**
 * Variant create and edit.
 *
 * The label carries the structured attribute a customer chooses — carat, bead
 * size, bracelet size — and the SKU is unique across the catalogue, which the
 * server enforces.
 */
export function VariantForm({
  productId,
  variant,
}: {
  productId: string;
  variant?: { id: string; title: string; sku: string; priceRupees: string };
}) {
  return (
    <AdminForm action={upsertVariantAction} submitLabel={variant ? "Save variant" : "Add variant"}>
      {(state) => (
        <div className="grid gap-3">
          <input name="productId" type="hidden" value={productId} />
          {variant ? <input name="variantId" type="hidden" value={variant.id} /> : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <AdminField
              error={state.fieldErrors.title?.[0]}
              hint="For example 5.05 carat, or 8 mm."
              label="Label"
              name="title"
            >
              <input className={adminInputClass} defaultValue={variant?.title} id="title" name="title" required />
            </AdminField>

            <AdminField error={state.fieldErrors.sku?.[0]} label="SKU" name="sku">
              <input className={adminInputClass} defaultValue={variant?.sku} id="sku" name="sku" required />
            </AdminField>

            <AdminField
              error={state.fieldErrors.pricePaise?.[0]}
              hint="Leave blank to use the product price."
              label="Price override"
              name="price"
            >
              <input
                className={adminInputClass}
                defaultValue={variant?.priceRupees}
                id="price"
                inputMode="decimal"
                name="price"
                step="0.01"
                type="number"
              />
            </AdminField>
          </div>
        </div>
      )}
    </AdminForm>
  );
}
