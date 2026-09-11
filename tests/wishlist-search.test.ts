import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ArticleStatus,
  InventoryStatus,
  PanditOnboardingStatus,
  ProductType,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  addToWishlist,
  isWishlisted,
  listWishlist,
  removeFromWishlist,
  wishlistCount,
} from "@/lib/account/wishlist";
import { search } from "@/lib/search/search";

/**
 * Wishlist and search.
 *
 * Both are read paths where the risk is the same shape: showing somebody
 * something they should not see. For the wishlist that is another customer's
 * list; for search it is a draft, an inactive product or an unapproved
 * practitioner.
 */
const RUN = `ws${Date.now().toString(36)}`;

type Actor = { id: string };

let customer: Actor;
let otherCustomer: Actor;
let activeProductId: string;
let inactiveProductId: string;
const term = `zz${RUN}zz`;

async function createUser(label: string): Promise<Actor> {
  return prisma.user.create({
    data: { name: `WS ${label}`, email: `${RUN}.${label}@example.test`, emailVerified: true },
    select: { id: true },
  });
}

async function createProduct(
  label: string,
  active: boolean,
  type: ProductType = ProductType.PHYSICAL,
) {
  const product = await prisma.product.create({
    data: {
      slug: `${RUN}-${label}`,
      title: `${term} ${label}`,
      description: `A product containing ${term} for search testing.`,
      type,
      pricePaise: 100_000,
      salePricePaise: active ? 80_000 : null,
      currency: "INR",
      active,
    },
    select: { id: true },
  });

  await prisma.inventory.create({
    data: { productId: product.id, quantity: 5, status: InventoryStatus.IN_STOCK },
  });

  return product.id;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set.");

  customer = await createUser("customer");
  otherCustomer = await createUser("other");

  activeProductId = await createProduct("active", true);
  inactiveProductId = await createProduct("inactive", false);
  await createProduct("gem", true, ProductType.GEMSTONE);

  // A draft article and a published one, both matching the search term.
  await prisma.article.create({
    data: {
      title: `${term} published`,
      slug: `${RUN}-published`,
      content: `Body mentioning ${term}.`.repeat(10),
      status: ArticleStatus.PUBLISHED,
      publishedAt: new Date(Date.now() - 60_000),
      tags: [],
    },
  });

  await prisma.article.create({
    data: {
      title: `${term} draft`,
      slug: `${RUN}-draft`,
      content: `Body mentioning ${term}.`.repeat(10),
      status: ArticleStatus.DRAFT,
      tags: [],
    },
  });

  // An unapproved practitioner whose name matches.
  const panditUser = await createUser("pandit");
  await prisma.panditProfile.create({
    data: {
      userId: panditUser.id,
      status: PanditOnboardingStatus.SUBMITTED,
      displayName: `${term} applicant`,
      languages: [],
      expertise: [],
      certifications: [],
    },
  });

  const activePanditUser = await createUser("activepandit");
  await prisma.panditProfile.create({
    data: {
      userId: activePanditUser.id,
      status: PanditOnboardingStatus.ACTIVE,
      slug: `${RUN}-listed`,
      displayName: `${term} listed`,
      languages: [],
      expertise: [],
      certifications: [],
    },
  });

  // An unpublished puja.
  await prisma.puja.create({
    data: {
      title: `${term} hidden puja`,
      slug: `${RUN}-hidden-puja`,
      description: `A puja mentioning ${term}.`,
      benefits: [],
      requirements: [],
      pricePaise: 100_000,
      imageUrls: [],
      modes: [],
      active: false,
    },
  });
}, 60_000);

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${RUN}.` } },
    select: { id: true, panditProfile: { select: { id: true } } },
  });

  const ids = users.map((user) => user.id);
  const panditIds = users.flatMap((user) => (user.panditProfile ? [user.panditProfile.id] : []));

  await prisma.wishlist.deleteMany({ where: { userId: { in: ids } } });
  await prisma.article.deleteMany({ where: { slug: { startsWith: RUN } } });
  await prisma.puja.deleteMany({ where: { slug: { startsWith: RUN } } });
  await prisma.panditProfile.deleteMany({ where: { id: { in: panditIds } } });
  await prisma.inventory.deleteMany({ where: { product: { slug: { startsWith: RUN } } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: RUN } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe("wishlist", () => {
  it("adds a product", async () => {
    const result = await addToWishlist({ userId: customer.id, productId: activeProductId });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.added).toBe(true);

    expect(await isWishlisted({ userId: customer.id, productId: activeProductId })).toBe(true);
  });

  it("treats a duplicate add as success without a second row", async () => {
    await addToWishlist({ userId: customer.id, productId: activeProductId });
    const again = await addToWishlist({ userId: customer.id, productId: activeProductId });

    expect(again.ok).toBe(true);
    if (again.ok) expect(again.alreadyPresent).toBe(true);

    const rows = await prisma.wishlist.count({
      where: { userId: customer.id, productId: activeProductId },
    });
    expect(rows).toBe(1);
  });

  it("refuses to save a product that is not listed", async () => {
    const result = await addToWishlist({ userId: customer.id, productId: inactiveProductId });
    expect(result.ok).toBe(false);
  });

  it("refuses an unknown product", async () => {
    const result = await addToWishlist({ userId: customer.id, productId: "does-not-exist" });
    expect(result.ok).toBe(false);
  });

  it("never returns another customer's list", async () => {
    await addToWishlist({ userId: customer.id, productId: activeProductId });

    const theirs = await listWishlist(otherCustomer.id);
    expect(theirs).toHaveLength(0);
    expect(await wishlistCount(otherCustomer.id)).toBe(0);
  });

  it("refuses to remove another customer's entry", async () => {
    await addToWishlist({ userId: customer.id, productId: activeProductId });

    const result = await removeFromWishlist({
      userId: otherCustomer.id,
      productId: activeProductId,
    });

    expect(result.ok).toBe(false);
    // The owner's entry is untouched.
    expect(await isWishlisted({ userId: customer.id, productId: activeProductId })).toBe(true);
  });

  it("removes the owner's own entry", async () => {
    await addToWishlist({ userId: customer.id, productId: activeProductId });

    const result = await removeFromWishlist({ userId: customer.id, productId: activeProductId });
    expect(result.ok).toBe(true);
    expect(await isWishlisted({ userId: customer.id, productId: activeProductId })).toBe(false);
  });

  it("reads price and stock live rather than from the saved row", async () => {
    await addToWishlist({ userId: customer.id, productId: activeProductId });

    const before = await listWishlist(customer.id);
    expect(before[0].priceMinor).toBe(80_000);
    expect(before[0].compareAtPriceMinor).toBe(100_000);

    await prisma.product.update({
      where: { id: activeProductId },
      data: { salePricePaise: null },
    });

    const after = await listWishlist(customer.id);
    // The saved entry reflects the new price, not the one at save time.
    expect(after[0].priceMinor).toBe(100_000);
    expect(after[0].compareAtPriceMinor).toBeNull();

    await prisma.product.update({
      where: { id: activeProductId },
      data: { salePricePaise: 80_000 },
    });
  });

  it("marks a delisted product unavailable rather than dropping it", async () => {
    await addToWishlist({ userId: customer.id, productId: activeProductId });

    await prisma.product.update({ where: { id: activeProductId }, data: { active: false } });

    const items = await listWishlist(customer.id);
    const entry = items.find((item) => item.productId === activeProductId);

    expect(entry).toBeDefined();
    expect(entry?.available).toBe(false);

    await prisma.product.update({ where: { id: activeProductId }, data: { active: true } });
  });
});

describe("search", () => {
  it("returns nothing for a query that is too short", async () => {
    const response = await search({ query: "a" });
    expect(response.results).toHaveLength(0);
    expect(response.total).toBe(0);
  });

  it("finds published resources", async () => {
    const response = await search({ query: term });

    expect(response.total).toBeGreaterThan(0);
    expect(response.results.some((result) => result.type === "article")).toBe(true);
    expect(response.results.some((result) => result.type === "pandit")).toBe(true);
    expect(response.results.some((result) => result.type === "gemstone")).toBe(true);
  });

  it("never returns a draft article", async () => {
    const response = await search({ query: term });

    expect(response.results.some((result) => result.title.includes("draft"))).toBe(false);
    expect(response.results.some((result) => result.href.includes(`${RUN}-draft`))).toBe(false);
  });

  it("never returns an inactive product", async () => {
    const response = await search({ query: term });
    expect(response.results.some((result) => result.href.includes(`${RUN}-inactive`))).toBe(false);
  });

  it("never returns an unapproved practitioner", async () => {
    const response = await search({ query: term });
    expect(response.results.some((result) => result.title.includes("applicant"))).toBe(false);
  });

  it("never returns an unpublished puja", async () => {
    const response = await search({ query: term });
    expect(response.results.some((result) => result.type === "puja")).toBe(false);
  });

  it("filters to a single type", async () => {
    const response = await search({ query: term, type: "article" });

    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results.every((result) => result.type === "article")).toBe(true);
  });

  it("reports counts per type", async () => {
    const response = await search({ query: term });

    const articleCount = response.results.filter((result) => result.type === "article").length;
    expect(response.countsByType.article).toBe(articleCount);
  });

  it("returns an empty result for a term nobody uses", async () => {
    const response = await search({ query: "qqqqzzzzxxxxnothing" });
    expect(response.results).toHaveLength(0);
    expect(response.total).toBe(0);
  });

  it("caps results per type", async () => {
    const response = await search({ query: term, limit: 2 });

    for (const type of Object.keys(response.countsByType) as Array<keyof typeof response.countsByType>) {
      expect(response.countsByType[type] ?? 0).toBeLessThanOrEqual(2);
    }
  });
});
