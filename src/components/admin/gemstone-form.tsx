"use client";

import { AdminField, AdminForm, adminInputClass } from "@/components/admin/admin-form";
import { SmoothInput } from "@/components/ui/smooth-input";
import { CERTIFICATION_LABS } from "@/lib/shop/attributes";
import { createGemstoneAction, updateGemstoneAction } from "@/app/admin/gemstones/actions";

/**
 * Gemstone create and edit.
 *
 * Measured properties and traditional associations are kept in separate
 * fieldsets, matching how the product page presents them: a carat weight is a
 * fact, a planetary association is a tradition, and the form should not invite
 * an operator to enter them as if they were the same kind of claim.
 */
export type GemstoneFormValues = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  sku: string;
  priceRupees: string;
  salePriceRupees: string;
  active: boolean;
  imageUrls: string;
  gemstoneType: string;
  carat: string;
  weightGrams: string;
  origin: string;
  treatment: string;
  color: string;
  clarity: string;
  cut: string;
  dimensionsMm: string;
  certified: boolean;
  certificationLab: string;
  certificateNumber: string;
  traditionalPlanet: string;
  careInstructions: string;
};

export function GemstoneForm({ initial }: { initial?: GemstoneFormValues }) {
  const isEdit = Boolean(initial?.id);

  return (
    <AdminForm
      action={isEdit ? updateGemstoneAction : createGemstoneAction}
      pendingLabel="Saving..."
      submitLabel={isEdit ? "Save gemstone" : "Create gemstone"}
    >
      {(state) => (
        <div className="grid gap-5">
          {isEdit ? <input name="productId" type="hidden" value={initial!.id} /> : null}

          <fieldset className="grid gap-4">
            <legend className="body-sm font-semibold text-slate-800">Listing</legend>

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
                className={adminInputClass}
                defaultValue={initial?.description}
                id="description"
                name="description"
                required
                rows={4}
              />
            </AdminField>

            <div className="grid gap-4 sm:grid-cols-3">
              <AdminField error={state.fieldErrors.sku?.[0]} label="SKU" name="sku">
                <SmoothInput className={adminInputClass} defaultValue={initial?.sku} id="sku" name="sku" />
              </AdminField>

              <AdminField
                error={state.fieldErrors.pricePaise?.[0]}
                hint="Affects future purchases only."
                label="Price (₹)"
                name="price"
              >
                <SmoothInput
                  className={adminInputClass}
                  defaultValue={initial?.priceRupees}
                  id="price"
                  min={0}
                  name="price"
                  required
                  step="0.01"
                  type="number"
                />
              </AdminField>

              <AdminField error={state.fieldErrors.salePricePaise?.[0]} label="Sale price (₹)" name="salePrice">
                <SmoothInput
                  className={adminInputClass}
                  defaultValue={initial?.salePriceRupees}
                  id="salePrice"
                  min={0}
                  name="salePrice"
                  step="0.01"
                  type="number"
                />
              </AdminField>
            </div>

            <AdminField hint="One URL per line, up to eight." label="Image URLs" name="imageUrls">
              <textarea
                className={adminInputClass}
                defaultValue={initial?.imageUrls}
                id="imageUrls"
                name="imageUrls"
                rows={3}
              />
            </AdminField>

            <label className="inline-flex cursor-pointer items-center gap-2 body-sm font-medium text-slate-800">
              <input
                className="size-4 accent-blue-600"
                defaultChecked={initial?.active}
                name="active"
                type="checkbox"
              />
              Visible in the shop
            </label>
          </fieldset>

          <fieldset className="grid gap-4 border-t border-slate-200 pt-5">
            <legend className="body-sm font-semibold text-slate-800">Measured properties</legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField error={state.fieldErrors.gemstoneType?.[0]} label="Stone" name="gemstoneType">
                <SmoothInput
                  className={adminInputClass}
                  defaultValue={initial?.gemstoneType}
                  id="gemstoneType"
                  name="gemstoneType"
                  placeholder="Blue Sapphire"
                  required
                />
              </AdminField>

              <AdminField error={state.fieldErrors.carat?.[0]} label="Carat" name="carat">
                <SmoothInput
                  className={adminInputClass}
                  defaultValue={initial?.carat}
                  id="carat"
                  min={0}
                  name="carat"
                  required
                  step="0.01"
                  type="number"
                />
              </AdminField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <AdminField error={state.fieldErrors.origin?.[0]} label="Origin" name="origin">
                <SmoothInput className={adminInputClass} defaultValue={initial?.origin} id="origin" name="origin" required />
              </AdminField>

              <AdminField error={state.fieldErrors.treatment?.[0]} label="Treatment" name="treatment">
                <SmoothInput
                  className={adminInputClass}
                  defaultValue={initial?.treatment}
                  id="treatment"
                  name="treatment"
                  placeholder="Unheated"
                  required
                />
              </AdminField>

              <AdminField error={state.fieldErrors.color?.[0]} label="Colour" name="color">
                <SmoothInput className={adminInputClass} defaultValue={initial?.color} id="color" name="color" required />
              </AdminField>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <AdminField label="Clarity" name="clarity">
                <SmoothInput className={adminInputClass} defaultValue={initial?.clarity} id="clarity" name="clarity" />
              </AdminField>
              <AdminField label="Cut" name="cut">
                <SmoothInput className={adminInputClass} defaultValue={initial?.cut} id="cut" name="cut" />
              </AdminField>
              <AdminField label="Dimensions (mm)" name="dimensionsMm">
                <SmoothInput
                  className={adminInputClass}
                  defaultValue={initial?.dimensionsMm}
                  id="dimensionsMm"
                  name="dimensionsMm"
                />
              </AdminField>
              <AdminField label="Weight (g)" name="weightGrams">
                <SmoothInput
                  className={adminInputClass}
                  defaultValue={initial?.weightGrams}
                  id="weightGrams"
                  min={0}
                  name="weightGrams"
                  step="0.01"
                  type="number"
                />
              </AdminField>
            </div>
          </fieldset>

          <fieldset className="grid gap-4 border-t border-slate-200 pt-5">
            <legend className="body-sm font-semibold text-slate-800">Certification</legend>

            <label className="inline-flex cursor-pointer items-center gap-2 body-sm font-medium text-slate-800">
              <input
                className="size-4 accent-blue-600"
                defaultChecked={initial?.certified}
                name="certified"
                type="checkbox"
              />
              Certified
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Laboratory" name="certificationLab">
                <select
                  className={adminInputClass}
                  defaultValue={initial?.certificationLab ?? ""}
                  id="certificationLab"
                  name="certificationLab"
                >
                  <option value="">Not certified</option>
                  {CERTIFICATION_LABS.map((lab) => (
                    <option key={lab} value={lab}>
                      {lab}
                    </option>
                  ))}
                </select>
              </AdminField>

              <AdminField label="Certificate number" name="certificateNumber">
                <SmoothInput
                  className={adminInputClass}
                  defaultValue={initial?.certificateNumber}
                  id="certificateNumber"
                  name="certificateNumber"
                />
              </AdminField>
            </div>
          </fieldset>

          <fieldset className="grid gap-4 border-t border-slate-200 pt-5">
            <legend className="body-sm font-semibold text-slate-800">Traditional association</legend>
            <p className="caption text-slate-500">
              Shown separately from the specification table, and never presented as a proven effect.
            </p>

            <AdminField label="Traditionally associated planet" name="traditionalPlanet">
              <SmoothInput
                className={adminInputClass}
                defaultValue={initial?.traditionalPlanet}
                id="traditionalPlanet"
                name="traditionalPlanet"
                placeholder="Saturn"
              />
            </AdminField>

            <AdminField label="Care instructions" name="careInstructions">
              <textarea
                className={adminInputClass}
                defaultValue={initial?.careInstructions}
                id="careInstructions"
                name="careInstructions"
                rows={3}
              />
            </AdminField>
          </fieldset>
        </div>
      )}
    </AdminForm>
  );
}
