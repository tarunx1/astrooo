import "server-only";

import { AuditAction, InventoryStatus, ProductType, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/admin/audit";
import { inventoryStatusFor } from "@/lib/admin/inventory";
import { productAttributesSchema } from "@/lib/shop/attributes";

/**
 * Product administration.
 *
 * A price change here affects future purchases only. `OrderItem` holds its own
 * frozen title, SKU and unit price, so nothing written here can rewrite what a
 * customer already paid — that property is covered by a regression test.
 */
const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by single hyphens.");

const moneySchema = z
  .number()
  .int("Prices are whole paise.")
  .min(0, "A price cannot be negative.")
  .max(10_000_000_00, "That price is implausibly large.");

export const productInputSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    slug: slugSchema,
    description: z.string().trim().min(10).max(5000),
    categoryId: z.string().trim().min(1).max(64).nullable().optional(),
    sku: z.string().trim().max(64).nullable().optional(),
    pricePaise: moneySchema,
    salePricePaise: moneySchema.nullable().optional(),
    active: z.boolean(),
    attributes: productAttributesSchema.optional(),
    imageUrls: z.array(z.string().trim().url()).max(8).optional(),
  })
  .superRefine((value, context) => {
    if (value.salePricePaise != null && value.salePricePaise >= value.pricePaise) {
      context.addIssue({
        code: "custom",
        path: ["salePricePaise"],
        message: "A sale price must be lower than the regular price.",
      });
    }
  });

export type ProductInput = z.infer<typeof productInputSchema>;

export type ProductMutationOutcome =
  | { ok: true; productId: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

async function syncImages(tx: Prisma.TransactionClient, productId: string, urls: string[] | undefined) {
  if (!urls) return;

  // Image references only. There is no upload pipeline; these are URLs or
  // storage keys an operator supplies.
  await tx.productImage.deleteMany({ where: { productId } });
  if (urls.length === 0) return;

  await tx.productImage.createMany({
    data: urls.map((url, index) => ({ productId, url, alt: "", sortOrder: index })),
  });
}

export async function createProduct(adminUserId: string, input: ProductInput): Promise<ProductMutationOutcome> {
  const existing = await prisma.product.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (existing) {
    return { ok: false, message: "That slug is already in use.", fieldErrors: { slug: ["Already in use."] } };
  }

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        title: input.title,
        slug: input.slug,
        description: input.description,
        type: ProductType.PHYSICAL,
        categoryId: input.categoryId ?? null,
        sku: input.sku || null,
        pricePaise: input.pricePaise,
        salePricePaise: input.salePricePaise ?? null,
        currency: "INR",
        active: input.active,
        attributes: (input.attributes ?? { kind: "GENERIC" }) as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    // New products start with zero stock; quantity only ever moves through a
    // recorded adjustment.
    await tx.inventory.create({
      data: { productId: created.id, quantity: 0, status: InventoryStatus.OUT_OF_STOCK },
    });

    await syncImages(tx, created.id, input.imageUrls);

    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: AuditAction.PRODUCT_CREATED,
      entityType: "Product",
      entityId: created.id,
      metadata: { slug: input.slug, title: input.title, pricePaise: input.pricePaise, active: input.active },
    });

    return created;
  });

  return { ok: true, productId: product.id };
}

export async function updateProduct(
  adminUserId: string,
  productId: string,
  input: ProductInput,
): Promise<ProductMutationOutcome> {
  const current = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, slug: true, pricePaise: true, salePricePaise: true, active: true, title: true },
  });

  if (!current) return { ok: false, message: "That product could not be found." };

  if (input.slug !== current.slug) {
    const clash = await prisma.product.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (clash) {
      return { ok: false, message: "That slug is already in use.", fieldErrors: { slug: ["Already in use."] } };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        title: input.title,
        slug: input.slug,
        description: input.description,
        categoryId: input.categoryId ?? null,
        sku: input.sku || null,
        pricePaise: input.pricePaise,
        salePricePaise: input.salePricePaise ?? null,
        active: input.active,
        ...(input.attributes ? { attributes: input.attributes as Prisma.InputJsonValue } : {}),
      },
    });

    await syncImages(tx, productId, input.imageUrls);

    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: AuditAction.PRODUCT_UPDATED,
      entityType: "Product",
      entityId: productId,
      metadata: { slug: input.slug, title: input.title },
    });

    // A price change is audited separately so it is easy to find later.
    if (current.pricePaise !== input.pricePaise || (current.salePricePaise ?? null) !== (input.salePricePaise ?? null)) {
      await recordAudit(tx, {
        actorUserId: adminUserId,
        action: AuditAction.PRODUCT_PRICE_CHANGED,
        entityType: "Product",
        entityId: productId,
        metadata: {
          fromPricePaise: current.pricePaise,
          toPricePaise: input.pricePaise,
          fromSalePricePaise: current.salePricePaise,
          toSalePricePaise: input.salePricePaise ?? null,
        },
      });
    }

    if (current.active !== input.active) {
      await recordAudit(tx, {
        actorUserId: adminUserId,
        action: input.active ? AuditAction.PRODUCT_ACTIVATED : AuditAction.PRODUCT_DEACTIVATED,
        entityType: "Product",
        entityId: productId,
        metadata: { slug: input.slug },
      });
    }
  });

  return { ok: true, productId };
}

/** Toggling visibility never touches historical orders or their line snapshots. */
export async function setProductActive(
  adminUserId: string,
  productId: string,
  active: boolean,
): Promise<ProductMutationOutcome> {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, slug: true } });
  if (!product) return { ok: false, message: "That product could not be found." };

  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: productId }, data: { active } });
    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: active ? AuditAction.PRODUCT_ACTIVATED : AuditAction.PRODUCT_DEACTIVATED,
      entityType: "Product",
      entityId: productId,
      metadata: { slug: product.slug },
    });
  });

  return { ok: true, productId };
}

export const variantInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  sku: z.string().trim().min(1).max(64),
  pricePaise: moneySchema.nullable().optional(),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export type VariantInput = z.infer<typeof variantInputSchema>;

export async function upsertVariant(
  adminUserId: string,
  input: { productId: string; variantId?: string | null; data: VariantInput },
): Promise<ProductMutationOutcome> {
  const product = await prisma.product.findUnique({ where: { id: input.productId }, select: { id: true } });
  if (!product) return { ok: false, message: "That product could not be found." };

  const clash = await prisma.productVariant.findUnique({ where: { sku: input.data.sku }, select: { id: true } });
  if (clash && clash.id !== input.variantId) {
    return { ok: false, message: "That SKU is already in use.", fieldErrors: { sku: ["Already in use."] } };
  }

  await prisma.$transaction(async (tx) => {
    if (input.variantId) {
      // Scoped by productId so a variant cannot be moved between products.
      const updated = await tx.productVariant.updateMany({
        where: { id: input.variantId, productId: input.productId },
        data: {
          title: input.data.title,
          sku: input.data.sku,
          pricePaise: input.data.pricePaise ?? null,
          ...(input.data.attributes ? { attributes: input.data.attributes as Prisma.InputJsonValue } : {}),
        },
      });

      if (updated.count === 1) {
        await recordAudit(tx, {
          actorUserId: adminUserId,
          action: AuditAction.PRODUCT_VARIANT_UPDATED,
          entityType: "ProductVariant",
          entityId: input.variantId,
          metadata: { productId: input.productId, sku: input.data.sku },
        });
      }
      return;
    }

    const created = await tx.productVariant.create({
      data: {
        productId: input.productId,
        title: input.data.title,
        sku: input.data.sku,
        pricePaise: input.data.pricePaise ?? null,
        ...(input.data.attributes ? { attributes: input.data.attributes as Prisma.InputJsonValue } : {}),
      },
      select: { id: true },
    });

    await tx.inventory.create({
      data: { productVariantId: created.id, quantity: 0, status: InventoryStatus.OUT_OF_STOCK },
    });

    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: AuditAction.PRODUCT_VARIANT_CREATED,
      entityType: "ProductVariant",
      entityId: created.id,
      metadata: { productId: input.productId, sku: input.data.sku },
    });
  });

  return { ok: true, productId: input.productId };
}

export type AdminProductRow = {
  id: string;
  title: string;
  slug: string;
  sku: string | null;
  pricePaise: number;
  salePricePaise: number | null;
  active: boolean;
  quantity: number;
  status: InventoryStatus;
  variantCount: number;
};

export async function listAdminProducts(input: {
  page: number;
  pageSize: number;
  search?: string;
  activeOnly?: boolean;
}): Promise<{ rows: AdminProductRow[]; total: number }> {
  const search = input.search?.trim();

  const where: Prisma.ProductWhereInput = {
    type: ProductType.PHYSICAL,
    ...(input.activeOnly ? { active: true } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        sku: true,
        pricePaise: true,
        salePricePaise: true,
        active: true,
        inventory: { select: { quantity: true, status: true } },
        _count: { select: { variants: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    total,
    rows: rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      sku: row.sku,
      pricePaise: row.pricePaise,
      salePricePaise: row.salePricePaise,
      active: row.active,
      quantity: row.inventory?.quantity ?? 0,
      status: row.inventory?.status ?? InventoryStatus.OUT_OF_STOCK,
      variantCount: row._count.variants,
    })),
  };
}

export async function getAdminProduct(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      sku: true,
      pricePaise: true,
      salePricePaise: true,
      currency: true,
      active: true,
      categoryId: true,
      attributes: true,
      images: { select: { id: true, url: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
      inventory: { select: { quantity: true, status: true } },
      variants: {
        select: {
          id: true,
          title: true,
          sku: true,
          pricePaise: true,
          attributes: true,
          inventory: { select: { quantity: true, status: true } },
        },
        orderBy: { title: "asc" },
      },
    },
  });
}

export { inventoryStatusFor };
