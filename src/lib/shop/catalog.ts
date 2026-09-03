import "server-only";

import { InventoryStatus, ProductType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  parseProductAttributes,
  toCareInstructions,
  toCertification,
  toSpecifications,
  toTraditionalUse,
  type Certification,
  type ProductAttributes,
  type Specification,
} from "@/lib/shop/attributes";

/**
 * Shop catalog reads.
 *
 * Every query filters on `active`, so an inactive product is invisible to
 * customers by construction rather than by remembering to check in each page.
 * Prices are integer minor units throughout; no float ever touches money.
 */
export type ProductCardData = {
  id: string;
  slug: string;
  title: string;
  categorySlug: string | null;
  categoryName: string | null;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  currency: string;
  imageUrl: string | null;
  imageAlt: string;
  inStock: boolean;
  inventoryStatus: InventoryStatus;
  certified: boolean;
};

export type ProductDetailData = ProductCardData & {
  description: string;
  sku: string | null;
  images: Array<{ url: string; alt: string }>;
  attributes: ProductAttributes;
  specifications: Specification[];
  certification: Certification | null;
  traditionalUse: string | null;
  careInstructions: string | null;
  quantityAvailable: number;
  variants: Array<{
    id: string;
    title: string;
    sku: string;
    priceMinor: number;
    inStock: boolean;
  }>;
  reviewCount: number;
  averageRating: number | null;
};

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  pricePaise: true,
  salePricePaise: true,
  currency: true,
  attributes: true,
  category: { select: { slug: true, name: true } },
  images: { select: { url: true, alt: true }, orderBy: { sortOrder: "asc" }, take: 1 },
  inventory: { select: { quantity: true, status: true } },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof CARD_SELECT }>;

/**
 * Resolves the effective price.
 *
 * A sale price is the price the customer pays; the original becomes the
 * compare-at. Returning both keeps the display honest.
 */
function resolvePricing(pricePaise: number, salePricePaise: number | null) {
  if (salePricePaise !== null && salePricePaise > 0 && salePricePaise < pricePaise) {
    return { priceMinor: salePricePaise, compareAtPriceMinor: pricePaise };
  }
  return { priceMinor: pricePaise, compareAtPriceMinor: null };
}

function toCard(row: CardRow): ProductCardData {
  const attributes = parseProductAttributes(row.attributes);
  const certification = toCertification(attributes);
  const { priceMinor, compareAtPriceMinor } = resolvePricing(row.pricePaise, row.salePricePaise);
  const status = row.inventory?.status ?? InventoryStatus.OUT_OF_STOCK;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    categorySlug: row.category?.slug ?? null,
    categoryName: row.category?.name ?? null,
    priceMinor,
    compareAtPriceMinor,
    currency: row.currency,
    imageUrl: row.images[0]?.url ?? null,
    imageAlt: row.images[0]?.alt ?? row.title,
    inStock: status === InventoryStatus.IN_STOCK && (row.inventory?.quantity ?? 0) > 0,
    inventoryStatus: status,
    certified: certification?.certified ?? false,
  };
}

export type CatalogFilters = {
  categorySlug?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  inStockOnly?: boolean;
  gemstoneType?: string;
  search?: string;
  sort?: "featured" | "price-asc" | "price-desc" | "newest";
  limit?: number;
};

function buildWhere(filters: CatalogFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    active: true,
    type: ProductType.PHYSICAL,
  };

  if (filters.categorySlug) where.category = { slug: filters.categorySlug };

  if (filters.minPriceMinor !== undefined || filters.maxPriceMinor !== undefined) {
    where.pricePaise = {
      ...(filters.minPriceMinor !== undefined ? { gte: filters.minPriceMinor } : {}),
      ...(filters.maxPriceMinor !== undefined ? { lte: filters.maxPriceMinor } : {}),
    };
  }

  if (filters.inStockOnly) {
    where.inventory = { is: { status: InventoryStatus.IN_STOCK, quantity: { gt: 0 } } };
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

function buildOrderBy(sort: CatalogFilters["sort"]): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "price-asc":
      return { pricePaise: "asc" };
    case "price-desc":
      return { pricePaise: "desc" };
    case "newest":
      return { createdAt: "desc" };
    default:
      return { createdAt: "desc" };
  }
}

export async function listProducts(filters: CatalogFilters = {}): Promise<ProductCardData[]> {
  const rows = await prisma.product.findMany({
    where: buildWhere(filters),
    select: CARD_SELECT,
    orderBy: buildOrderBy(filters.sort),
    take: Math.min(filters.limit ?? 48, 96),
  });

  const cards = rows.map(toCard);

  // Gemstone type lives inside the attributes JSON, so it is filtered after
  // parsing rather than with a fragile JSON path query.
  if (!filters.gemstoneType) return cards;

  const wanted = filters.gemstoneType.toLowerCase();
  return cards.filter((_, index) => {
    const attributes = parseProductAttributes(rows[index].attributes);
    return attributes.kind === "GEMSTONE" && attributes.gemstoneType.toLowerCase() === wanted;
  });
}

/** Returns null for an unknown or inactive slug, so both 404 identically. */
export async function getProductBySlug(slug: string): Promise<ProductDetailData | null> {
  const row = await prisma.product.findFirst({
    where: { slug, active: true },
    select: {
      ...CARD_SELECT,
      description: true,
      sku: true,
      images: { select: { url: true, alt: true }, orderBy: { sortOrder: "asc" } },
      variants: {
        select: {
          id: true,
          title: true,
          sku: true,
          pricePaise: true,
          salePricePaise: true,
          inventory: { select: { quantity: true, status: true } },
        },
      },
      reviews: { select: { rating: true } },
    },
  });

  if (!row) return null;

  const card = toCard({ ...row, images: row.images.slice(0, 1) });
  const attributes = parseProductAttributes(row.attributes);
  const ratings = row.reviews.map((review) => review.rating);

  return {
    ...card,
    description: row.description,
    sku: row.sku,
    images: row.images,
    attributes,
    specifications: toSpecifications(attributes),
    certification: toCertification(attributes),
    traditionalUse: toTraditionalUse(attributes),
    careInstructions: toCareInstructions(attributes),
    quantityAvailable: row.inventory?.quantity ?? 0,
    variants: row.variants.map((variant) => {
      const pricing = resolvePricing(variant.pricePaise ?? row.pricePaise, variant.salePricePaise);
      return {
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        priceMinor: pricing.priceMinor,
        inStock: variant.inventory?.status === InventoryStatus.IN_STOCK && (variant.inventory?.quantity ?? 0) > 0,
      };
    }),
    reviewCount: ratings.length,
    averageRating: ratings.length ? Number((ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)) : null,
  };
}

export async function listShopCategories(): Promise<Array<{ slug: string; name: string; productCount: number }>> {
  const rows = await prisma.category.findMany({
    select: {
      slug: true,
      name: true,
      _count: { select: { products: { where: { active: true, type: ProductType.PHYSICAL } } } },
    },
    orderBy: { name: "asc" },
  });

  return rows
    .map((row) => ({ slug: row.slug, name: row.name, productCount: row._count.products }))
    .filter((row) => row.productCount > 0);
}

export async function listRelatedProducts(
  productId: string,
  categorySlug: string | null,
  limit = 4,
): Promise<ProductCardData[]> {
  if (!categorySlug) return [];

  const rows = await prisma.product.findMany({
    where: {
      active: true,
      type: ProductType.PHYSICAL,
      id: { not: productId },
      category: { slug: categorySlug },
    },
    select: CARD_SELECT,
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return rows.map(toCard);
}

/** Re-exported from the client-safe pricing module so both sides share one implementation. */
export { formatMoneyMinor } from "@/lib/shop/pricing";
