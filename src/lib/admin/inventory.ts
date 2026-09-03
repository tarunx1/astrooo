import "server-only";

import { AuditAction, InventoryAdjustmentReason, InventoryStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/admin/audit";

/**
 * Inventory operations.
 *
 * Stock is only ever changed by a recorded adjustment. The adjustment row, the
 * Inventory write and the audit entry happen in one transaction, so the running
 * quantity is always explainable from history and never silently mutated.
 *
 * Adjustments use the same guarded-update discipline as checkout: the write is
 * conditional on the quantity the caller read, so a concurrent checkout
 * decrement cannot be overwritten.
 */
export const LOW_STOCK_THRESHOLD = 3;

export function inventoryStatusFor(quantity: number): InventoryStatus {
  if (quantity <= 0) return InventoryStatus.OUT_OF_STOCK;
  if (quantity <= LOW_STOCK_THRESHOLD) return InventoryStatus.LOW_STOCK;
  return InventoryStatus.IN_STOCK;
}

export type AdjustmentTarget = { productId: string } | { productVariantId: string };

export type AdjustmentOutcome =
  | { ok: true; previousQuantity: number; newQuantity: number; adjustmentId: string }
  | { ok: false; reason: "not_found" | "would_go_negative" | "no_change" | "conflict"; message: string };

const MESSAGES = {
  not_found: "That inventory record could not be found.",
  would_go_negative: "This adjustment would take stock below zero. Backorders are not supported.",
  no_change: "Enter a non-zero adjustment.",
  conflict: "Stock changed while you were editing. Reload and try again.",
} as const;

function targetWhere(target: AdjustmentTarget): Prisma.InventoryWhereInput {
  return "productId" in target ? { productId: target.productId } : { productVariantId: target.productVariantId };
}

/**
 * Applies a relative stock change.
 *
 * A relative delta rather than an absolute set, so two operators adjusting at
 * once compose instead of clobbering. Negative results are refused: the business
 * does not support backorders.
 */
export async function adjustInventory(input: {
  adminUserId: string;
  target: AdjustmentTarget;
  delta: number;
  reason: InventoryAdjustmentReason;
  note?: string;
}): Promise<AdjustmentOutcome> {
  const delta = Math.trunc(input.delta);
  if (!Number.isFinite(delta) || delta === 0) {
    return { ok: false, reason: "no_change", message: MESSAGES.no_change };
  }

  return prisma.$transaction(async (tx) => {
    const record = await tx.inventory.findFirst({
      where: targetWhere(input.target),
      select: { id: true, quantity: true, productId: true, productVariantId: true },
    });

    if (!record) return { ok: false as const, reason: "not_found" as const, message: MESSAGES.not_found };

    const previousQuantity = record.quantity;
    const newQuantity = previousQuantity + delta;

    if (newQuantity < 0) {
      return { ok: false as const, reason: "would_go_negative" as const, message: MESSAGES.would_go_negative };
    }

    // Guarded update: only applies if the quantity is still what we just read,
    // so a concurrent checkout decrement is never overwritten.
    const applied = await tx.inventory.updateMany({
      where: { id: record.id, quantity: previousQuantity },
      data: { quantity: newQuantity, status: inventoryStatusFor(newQuantity) },
    });

    if (applied.count !== 1) {
      return { ok: false as const, reason: "conflict" as const, message: MESSAGES.conflict };
    }

    const adjustment = await tx.inventoryAdjustment.create({
      data: {
        productId: record.productId,
        productVariantId: record.productVariantId,
        adminUserId: input.adminUserId,
        delta,
        previousQuantity,
        newQuantity,
        reason: input.reason,
        note: input.note?.trim() || null,
      },
      select: { id: true },
    });

    await recordAudit(tx, {
      actorUserId: input.adminUserId,
      action: AuditAction.INVENTORY_ADJUSTED,
      entityType: record.productVariantId ? "ProductVariant" : "Product",
      entityId: record.productVariantId ?? record.productId ?? record.id,
      metadata: { delta, previousQuantity, newQuantity, reason: input.reason },
    });

    return { ok: true as const, previousQuantity, newQuantity, adjustmentId: adjustment.id };
  });
}

export type InventoryRow = {
  inventoryId: string;
  productId: string | null;
  productVariantId: string | null;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  status: InventoryStatus;
  isLowStock: boolean;
  productActive: boolean;
};

export async function listInventory(input: {
  page: number;
  pageSize: number;
  search?: string;
  onlyLowStock?: boolean;
}): Promise<{ rows: InventoryRow[]; total: number }> {
  const search = input.search?.trim();

  const where: Prisma.InventoryWhereInput = {
    ...(input.onlyLowStock ? { quantity: { lte: LOW_STOCK_THRESHOLD } } : {}),
    ...(search
      ? {
          OR: [
            { product: { title: { contains: search, mode: "insensitive" } } },
            { product: { sku: { contains: search, mode: "insensitive" } } },
            { productVariant: { sku: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      select: {
        id: true,
        quantity: true,
        status: true,
        productId: true,
        productVariantId: true,
        product: { select: { title: true, sku: true, active: true } },
        productVariant: {
          select: { title: true, sku: true, product: { select: { title: true, active: true } } },
        },
      },
      orderBy: [{ quantity: "asc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.inventory.count({ where }),
  ]);

  return {
    total,
    rows: rows.map((row) => ({
      inventoryId: row.id,
      productId: row.productId,
      productVariantId: row.productVariantId,
      title: row.product?.title ?? row.productVariant?.product.title ?? "Unknown product",
      variantTitle: row.productVariant?.title ?? null,
      sku: row.productVariant?.sku ?? row.product?.sku ?? null,
      quantity: row.quantity,
      status: row.status,
      isLowStock: row.quantity > 0 && row.quantity <= LOW_STOCK_THRESHOLD,
      productActive: row.product?.active ?? row.productVariant?.product.active ?? false,
    })),
  };
}

export async function listAdjustmentsFor(target: AdjustmentTarget, limit = 20) {
  return prisma.inventoryAdjustment.findMany({
    where: targetWhere(target) as Prisma.InventoryAdjustmentWhereInput,
    select: {
      id: true,
      delta: true,
      previousQuantity: true,
      newQuantity: true,
      reason: true,
      note: true,
      createdAt: true,
      adminUser: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
