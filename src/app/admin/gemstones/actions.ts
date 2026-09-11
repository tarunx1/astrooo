"use server";

import { revalidatePath } from "next/cache";
import { ProductType } from "@prisma/client";
import { z } from "zod";
import { authorizeAdminAction } from "@/lib/auth/admin";
import { createProduct, productInputSchema, setProductActive, updateProduct } from "@/lib/admin/products";
import { CERTIFICATION_LABS, gemstoneAttributesSchema } from "@/lib/shop/attributes";
import { prisma } from "@/lib/db/prisma";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * Gemstone administration.
 *
 * Gemstones are products, so these reuse the product service rather than
 * reimplementing catalogue writes: the same slug uniqueness, the same immutable
 * purchase snapshots, the same guarded inventory. What differs is the
 * `ProductType` and a few gemstone-specific attributes, which live in the
 * product's `attributes` JSON.
 *
 * That is why gemstone CRUD is here and not inside a Pandit component - stock
 * and pricing are commerce, and a practitioner recommending a stone is not the
 * same act as selling one.
 */
const idSchema = z.string().trim().min(1).max(64);

function denied(reason?: string): AdminActionState {
  return { ok: false, error: reason ?? "You are not authorised to perform this action.", fieldErrors: {} };
}

function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value === "string") values[name] = value;
  }
  return values;
}

function failure(
  error: string,
  fieldErrors: Record<string, string[]> = {},
  formData?: FormData,
): AdminActionState {
  return { ok: false, error, fieldErrors, values: formData ? submittedValues(formData) : undefined };
}

function success(message: string): AdminActionState {
  return { ok: true, error: null, message, fieldErrors: {} };
}

function rupeesToPaise(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function optionalText(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Reads the gemstone form.
 *
 * The attribute shape is the one the shop already defines and renders, not a
 * second schema invented here - so a stone entered through this form produces
 * exactly the specification table the product page knows how to show, and a
 * traditional association stays separated from a measured property.
 */
function readGemstoneForm(formData: FormData) {
  const imageUrls = String(formData.get("imageUrls") ?? "")
    .split(/[\n,]/)
    .map((url) => url.trim())
    .filter(Boolean);

  const numberOrUndefined = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string" || !value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const lab = optionalText(formData.get("certificationLab"));

  const attributes = gemstoneAttributesSchema.safeParse({
    kind: "GEMSTONE",
    gemstoneType: formData.get("gemstoneType"),
    carat: numberOrUndefined(formData.get("carat")),
    weightGrams: numberOrUndefined(formData.get("weightGrams")),
    origin: formData.get("origin"),
    treatment: formData.get("treatment"),
    color: formData.get("color"),
    clarity: optionalText(formData.get("clarity")) ?? undefined,
    cut: optionalText(formData.get("cut")) ?? undefined,
    dimensionsMm: optionalText(formData.get("dimensionsMm")) ?? undefined,
    certified: formData.get("certified") === "on",
    certificationLab:
      lab && (CERTIFICATION_LABS as readonly string[]).includes(lab) ? lab : undefined,
    certificateNumber: optionalText(formData.get("certificateNumber")) ?? undefined,
    traditionalPlanet: optionalText(formData.get("traditionalPlanet")) ?? undefined,
    careInstructions: optionalText(formData.get("careInstructions")) ?? undefined,
  });

  const base = productInputSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    categoryId: optionalText(formData.get("categoryId")),
    sku: optionalText(formData.get("sku")),
    pricePaise: rupeesToPaise(formData.get("price")) ?? -1,
    salePricePaise: rupeesToPaise(formData.get("salePrice")),
    active: formData.get("active") === "on",
    imageUrls,
  });

  return { base, attributes };
}

export async function createGemstoneAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeAdminAction("gemstones.manage");
  if (!auth.ok) return denied(auth.error);

  const { base, attributes } = readGemstoneForm(formData);
  if (!base.success) {
    return failure("Check the highlighted fields.", z.flattenError(base.error).fieldErrors, formData);
  }
  if (!attributes.success) {
    return failure("Check the gemstone details.", z.flattenError(attributes.error).fieldErrors, formData);
  }

  const result = await createProduct(
    auth.admin.id,
    { ...base.data, attributes: attributes.data },
    ProductType.GEMSTONE,
  );

  if (!result.ok) return failure(result.message, result.fieldErrors, formData);

  revalidatePath("/admin/gemstones");
  revalidatePath("/shop");
  return success("Gemstone created. It starts with zero stock until you record an adjustment.");
}

export async function updateGemstoneAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeAdminAction("gemstones.manage");
  if (!auth.ok) return denied(auth.error);

  const productId = idSchema.safeParse(formData.get("productId"));
  if (!productId.success) return failure("That gemstone could not be found.");

  const { base, attributes } = readGemstoneForm(formData);
  if (!base.success) {
    return failure("Check the highlighted fields.", z.flattenError(base.error).fieldErrors, formData);
  }
  if (!attributes.success) {
    return failure("Check the gemstone details.", z.flattenError(attributes.error).fieldErrors, formData);
  }

  const result = await updateProduct(auth.admin.id, productId.data, {
    ...base.data,
    attributes: attributes.data,
  });

  if (!result.ok) return failure(result.message, result.fieldErrors, formData);

  revalidatePath("/admin/gemstones");
  revalidatePath(`/admin/gemstones/${productId.data}`);
  revalidatePath("/shop");
  return success("Saved. Existing orders keep the price they were placed at.");
}

/**
 * Archives or restores a gemstone.
 *
 * Archiving deactivates rather than deletes: an OrderItem references the
 * product, and history that points at a deleted row is not history.
 */
export async function setGemstoneActiveAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeAdminAction("gemstones.manage");
  if (!auth.ok) return denied(auth.error);

  const productId = idSchema.safeParse(formData.get("productId"));
  if (!productId.success) return failure("That gemstone could not be found.");

  // Confirmed to be a gemstone before acting, so this action cannot be used to
  // reach the wider product catalogue with only `gemstones.manage`.
  const product = await prisma.product.findFirst({
    where: { id: productId.data, type: ProductType.GEMSTONE },
    select: { id: true },
  });

  if (!product) return failure("That gemstone could not be found.");

  const active = formData.get("active") === "true";
  const result = await setProductActive(auth.admin.id, product.id, active);
  if (!result.ok) return failure(result.message);

  revalidatePath("/admin/gemstones");
  revalidatePath("/shop");
  return success(active ? "Gemstone is visible in the shop." : "Gemstone archived. Past orders are unchanged.");
}
