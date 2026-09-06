"use client";

import { AdminField, AdminForm, adminInputClass } from "@/components/admin/admin-form";
import { createProductAction, updateProductAction } from "@/app/admin/actions";
import { SmoothInput } from "@/components/ui/smooth-input";

/**
 * Product create and edit.
 *
 * Prices are entered in rupees and converted to integer paise on the server. A
 * change here affects future purchases only; existing OrderItems keep their own
 * frozen price, and the form says so.
 */
export type ProductFormValues = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  sku: string;
  priceRupees: string;
  salePriceRupees: string;
  active: boolean;
  imageUrls: string;
};

export function ProductForm({ initial }: { initial?: ProductFormValues }) {
  const isEdit = Boolean(initial?.id);

  return (
    <AdminForm
      action={isEdit ? updateProductAction : createProductAction}
      submitLabel={isEdit ? "Save product" : "Create product"}
    >
      {(state) => (
        <div className="grid gap-4">
          {isEdit ? <input name="productId" type="hidden" value={initial!.id} /> : null}

          <AdminField error={state.fieldErrors.title?.[0]} label="Title" name="title">
            <SmoothInput className={adminInputClass} defaultValue={initial?.title} id="title" name="title" required />
          </AdminField>

          <AdminField
            error={state.fieldErrors.slug?.[0]}
            hint="Lowercase words separated by hyphens. Used in the product URL."
            label="Slug"
            name="slug"
          >
            <SmoothInput className={adminInputClass} defaultValue={initial?.slug} id="slug" name="slug" required />
          </AdminField>

          <AdminField error={state.fieldErrors.description?.[0]} label="Description" name="description">
            <textarea
              className={`${adminInputClass} min-h-28`}
              defaultValue={initial?.description}
              id="description"
              name="description"
              required
            />
          </AdminField>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField error={state.fieldErrors.sku?.[0]} label="SKU" name="sku">
              <SmoothInput className={adminInputClass} defaultValue={initial?.sku} id="sku" name="sku" />
            </AdminField>
            <AdminField
              error={state.fieldErrors.pricePaise?.[0]}
              hint="In rupees. Stored as whole paise."
              label="Price"
              name="price"
            >
              <input
                className={adminInputClass}
                defaultValue={initial?.priceRupees}
                id="price"
                inputMode="decimal"
                name="price"
                required
                step="0.01"
                type="number"
              />
            </AdminField>
          </div>

          <AdminField
            error={state.fieldErrors.salePricePaise?.[0]}
            hint="Optional. Must be lower than the regular price."
            label="Sale price"
            name="salePrice"
          >
            <input
              className={adminInputClass}
              defaultValue={initial?.salePriceRupees}
              id="salePrice"
              inputMode="decimal"
              name="salePrice"
              step="0.01"
              type="number"
            />
          </AdminField>

          <AdminField
            hint="One image URL or storage key per line. There is no upload pipeline yet — these are references only."
            label="Image references"
            name="imageUrls"
          >
            <textarea
              className={`${adminInputClass} min-h-20`}
              defaultValue={initial?.imageUrls}
              id="imageUrls"
              name="imageUrls"
            />
          </AdminField>

          <label className="flex items-center gap-2 body-sm text-foreground-secondary" htmlFor="active">
            <input className="size-4" defaultChecked={initial?.active ?? false} id="active" name="active" type="checkbox" />
            Visible in the shop
          </label>

          <p className="caption text-foreground-muted">
            Price changes apply to future purchases only. Existing orders keep the price the customer actually paid.
          </p>
        </div>
      )}
    </AdminForm>
  );
}
