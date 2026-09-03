"use server";

import { revalidatePath } from "next/cache";
import { InventoryAdjustmentReason, OrderStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { authorizeAdminAction } from "@/lib/auth/admin";
import { adjustInventory } from "@/lib/admin/inventory";
import { transitionOrderStatus, updateShipmentDetails } from "@/lib/admin/order-transitions";
import { createProduct, productInputSchema, setProductActive, updateProduct, upsertVariant, variantInputSchema } from "@/lib/admin/products";
import {
  changeUserRole,
  couponSchema,
  createCoupon,
  reportDefinitionSchema,
  updateCoupon,
  updateReportDefinition,
} from "@/lib/admin/catalog-admin";
import { retryGeneratedReport } from "@/lib/admin/report-retry";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * Admin Server Actions.
 *
 * Every action starts with `authorizeAdminAction()`, which re-reads the role
 * from the database using the id on the server session. Nothing here trusts a
 * role, a user id or a current-state value submitted by the browser: the
 * authoritative record is always reloaded before a write.
 *
 * Notably absent: any action that could create or alter a payment fact. There is
 * no "mark as paid", no amount edit and no way to touch providerPaymentId,
 * captured amount or paidAt.
 */
const idSchema = z.string().trim().min(1).max(64);

function denied(): AdminActionState {
  return { ok: false, error: "You are not authorised to perform this action.", fieldErrors: {} };
}

function failure(error: string, fieldErrors: Record<string, string[]> = {}): AdminActionState {
  return { ok: false, error, fieldErrors };
}

function success(message: string): AdminActionState {
  return { ok: true, error: null, message, fieldErrors: {} };
}

/** Money arrives from the form in rupees; it is converted to integer paise here. */
function rupeesToPaise(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function optionalText(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

function readProductForm(formData: FormData) {
  const imageUrls = String(formData.get("imageUrls") ?? "")
    .split(/[\n,]/)
    .map((url) => url.trim())
    .filter(Boolean);

  return productInputSchema.safeParse({
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
}

export async function createProductAction(_state: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const auth = await authorizeAdminAction();
  if (!auth.ok) return denied();

  const parsed = readProductForm(formData);
  if (!parsed.success) return failure("Check the highlighted fields.", parsed.error.flatten().fieldErrors);

  const result = await createProduct(auth.admin.id, parsed.data);
  if (!result.ok) return failure(result.message, result.fieldErrors);

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return success("Product created.");
}

export async function updateProductAction(_state: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const auth = await authorizeAdminAction();
  if (!auth.ok) return denied();

  const productId = idSchema.safeParse(formData.get("productId"));
  if (!productId.success) return failure("That product could not be found.");

  const parsed = readProductForm(formData);
  if (!parsed.success) return failure("Check the highlighted fields.", parsed.error.flatten().fieldErrors);

  const result = await updateProduct(auth.admin.id, productId.data, parsed.data);
  if (!result.ok) return failure(result.message, result.fieldErrors);

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId.data}`);
  revalidatePath("/shop");
  return success("Product saved. Existing orders are unaffected.");
}

export async function setProductActiveAction(_state: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const auth = await authorizeAdminAction();
  if (!auth.ok) return denied();

  const productId = idSchema.safeParse(formData.get("productId"));
  if (!productId.success) return failure("That product could not be found.");

  const active = formData.get("active") === "true";
  const result = await setProductActive(auth.admin.id, productId.data, active);
  if (!result.ok) return failure(result.message);

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return success(active ? "Product is now visible in the shop." : "Product hidden from the shop. Past orders are unchanged.");
}

export async function upsertVariantAction(_state: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const auth = await authorizeAdminAction();
  if (!auth.ok) return denied();

  const productId = idSchema.safeParse(formData.get("productId"));
  if (!productId.success) return failure("That product could not be found.");

  const parsed = variantInputSchema.safeParse({
    title: formData.get("title"),
    sku: formData.get("sku"),
    pricePaise: rupeesToPaise(formData.get("price")),
  });
  if (!parsed.success) return failure("Check the highlighted fields.", parsed.error.flatten().fieldErrors);

  const result = await upsertVariant(auth.admin.id, {
    productId: productId.data,
    variantId: optionalText(formData.get("variantId")),
    data: parsed.data,
  });
  if (!result.ok) return failure(result.message, result.fieldErrors);

  revalidatePath(`/admin/products/${productId.data}`);
  return success("Variant saved.");
}

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */

export async function adjustInventoryAction(_state: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const auth = await authorizeAdminAction();
  if (!auth.ok) return denied();

  const parsed = z
    .object({
      delta: z.coerce.number().int().min(-100_000).max(100_000),
      reason: z.nativeEnum(InventoryAdjustmentReason),
      note: z.string().trim().max(300).optional(),
      productId: z.string().trim().max(64).optional(),
      productVariantId: z.string().trim().max(64).optional(),
    })
    .safeParse({
      delta: formData.get("delta"),
      reason: formData.get("reason"),
      note: formData.get("note") ?? undefined,
      productId: optionalText(formData.get("productId")) ?? undefined,
      productVariantId: optionalText(formData.get("productVariantId")) ?? undefined,
    });

  if (!parsed.success) return failure("Enter a whole number and a reason.", parsed.error.flatten().fieldErrors);

  const target = parsed.data.productVariantId
    ? { productVariantId: parsed.data.productVariantId }
    : parsed.data.productId
      ? { productId: parsed.data.productId }
      : null;

  if (!target) return failure("That inventory record could not be found.");

  const result = await adjustInventory({
    adminUserId: auth.admin.id,
    target,
    delta: parsed.data.delta,
    reason: parsed.data.reason,
    note: parsed.data.note,
  });

  if (!result.ok) return failure(result.message);

  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  revalidatePath("/shop");
  return success(`Stock updated from ${result.previousQuantity} to ${result.newQuantity}.`);
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export async function transitionOrderAction(_state: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const auth = await authorizeAdminAction();
  if (!auth.ok) return denied();

  const parsed = z
    .object({ orderId: idSchema, to: z.nativeEnum(OrderStatus) })
    .safeParse({ orderId: formData.get("orderId"), to: formData.get("to") });

  if (!parsed.success) return failure("That status change is not recognised.");

  const result = await transitionOrderStatus({
    adminUserId: auth.admin.id,
    orderId: parsed.data.orderId,
    to: parsed.data.to,
  });

  if (!result.ok) return failure(result.message);

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  revalidatePath("/admin");
  revalidatePath("/account/orders");
  return success(`Order moved from ${result.from} to ${result.to}.`);
}

export async function updateShipmentAction(_state: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const auth = await authorizeAdminAction();
  if (!auth.ok) return denied();

  const orderId = idSchema.safeParse(formData.get("orderId"));
  if (!orderId.success) return failure("That order could not be found.");

  const result = await updateShipmentDetails({
    adminUserId: auth.admin.id,
    orderId: orderId.data,
    carrierName: optionalText(formData.get("carrierName")),
    trackingNumber: optionalText(formData.get("trackingNumber")),
    trackingUrl: optionalText(formData.get("trackingUrl")),
  });

  if (!result.ok) return failure(result.message);

  revalidatePath(`/admin/orders/${orderId.data}`);
  revalidatePath("/account/orders");
  return success("Shipment details saved.");
}

/* ------------------------------------------------------------------ */
/* Report catalogue and generation                                     */
/* ------------------------------------------------------------------ */

export async function updateReportDefinitionAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeAdminAction();
  if (!auth.ok) return denied();

  const definitionId = idSchema.safeParse(formData.get("definitionId"));
  if (!definitionId.success) return failure("That report could not be found.");

  const sections = String(formData.get("sectionsIncluded") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = reportDefinitionSchema.safeParse({
    name: formData.get("name"),
    shortDescription: formData.get("shortDescription"),
    description: formData.get("description"),
    priceMinor: rupeesToPaise(formData.get("price")) ?? -1,
    estimatedPages: optionalNumber(formData.get("estimatedPages")) ?? 0,
    sortOrder: optionalNumber(formData.get("sortOrder")) ?? 0,
    isActive: formData.get("isActive") === "on",
    sectionsIncluded: sections,
  });

  if (!parsed.success) return failure("Check the highlighted fields.", parsed.error.flatten().fieldErrors);

  const result = await updateReportDefinition(auth.admin.id, definitionId.data, parsed.data);
  if (!result.ok) return failure(result.message);

  revalidatePath("/admin/reports");
  revalidatePath("/reports");
  return success("Report catalogue updated. Existing orders keep their original snapshot.");
}

export async function retryReportAction(_state: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const auth = await authorizeAdminAction();
  if (!auth.ok) return denied();

  const generatedReportId = idSchema.safeParse(formData.get("generatedReportId"));
  if (!generatedReportId.success) return failure("That report could not be found.");

  const result = await retryGeneratedReport({
    adminUserId: auth.admin.id,
    generatedReportId: generatedReportId.data,
  });

  if (!result.ok) return failure(result.message);

  revalidatePath("/admin/generated-reports");
  revalidatePath("/admin");
  return success("Report re-queued. The customer is not charged again.");
}

/* ------------------------------------------------------------------ */
/* Coupons                                                             */
/* ------------------------------------------------------------------ */

function readCouponForm(formData: FormData) {
  return couponSchema.safeParse({
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    description: optionalText(formData.get("description")),
    percentOff: optionalNumber(formData.get("percentOff")),
    amountOffPaise: rupeesToPaise(formData.get("amountOff")),
    minOrderPaise: rupeesToPaise(formData.get("minOrder")),
    maxDiscountPaise: rupeesToPaise(formData.get("maxDiscount")),
    usageLimit: optionalNumber(formData.get("usageLimit")),
    perUserLimit: optionalNumber(formData.get("perUserLimit")),
    startsAt: optionalText(formData.get("startsAt")),
    endsAt: optionalText(formData.get("endsAt")),
    active: formData.get("active") === "on",
  });
}

export async function createCouponAction(_state: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const auth = await authorizeAdminAction();
  if (!auth.ok) return denied();

  const parsed = readCouponForm(formData);
  if (!parsed.success) return failure("Check the highlighted fields.", parsed.error.flatten().fieldErrors);

  const result = await createCoupon(auth.admin.id, parsed.data);
  if (!result.ok) return failure(result.message);

  revalidatePath("/admin/coupons");
  return success("Coupon created.");
}

export async function updateCouponAction(_state: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const auth = await authorizeAdminAction();
  if (!auth.ok) return denied();

  const couponId = idSchema.safeParse(formData.get("couponId"));
  if (!couponId.success) return failure("That coupon could not be found.");

  const parsed = readCouponForm(formData);
  if (!parsed.success) return failure("Check the highlighted fields.", parsed.error.flatten().fieldErrors);

  const result = await updateCoupon(auth.admin.id, couponId.data, parsed.data);
  if (!result.ok) return failure(result.message);

  revalidatePath("/admin/coupons");
  revalidatePath(`/admin/coupons/${couponId.data}`);
  return success("Coupon saved. Past redemptions are unchanged.");
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export async function changeUserRoleAction(_state: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const auth = await authorizeAdminAction();
  if (!auth.ok) return denied();

  const parsed = z
    .object({ targetUserId: idSchema, role: z.nativeEnum(UserRole) })
    .safeParse({ targetUserId: formData.get("targetUserId"), role: formData.get("role") });

  if (!parsed.success) return failure("That role is not recognised.");

  // The actor is the session identity, never a form field, so a crafted request
  // cannot elevate its own account.
  const result = await changeUserRole({
    adminUserId: auth.admin.id,
    targetUserId: parsed.data.targetUserId,
    role: parsed.data.role,
  });

  if (!result.ok) return failure(result.message);

  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
  return success("Role updated and recorded in the audit log.");
}
