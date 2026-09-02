import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer, Section, SectionHeader } from "@/components/layout/primitives";
import { ProductGrid } from "@/components/shop/product-primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { listProducts, listShopCategories } from "@/lib/shop/catalog";
import { brand } from "@/config/brand";

type Params = { params: Promise<{ category: string }> };

async function findCategory(slug: string) {
  const categories = await listShopCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await findCategory(slug);
  if (!category) return { title: "Category not found" };

  return {
    title: `${category.name} | Ravish Astro Store`,
    description: `Browse ${category.name.toLowerCase()} with verified specifications, origin and certification details.`,
    alternates: { canonical: `${brand.url}/shop/${slug}` },
  };
}

export default async function ShopCategoryPage({ params }: Params) {
  const { category: slug } = await params;
  const category = await findCategory(slug);
  if (!category) notFound();

  const products = await listProducts({ categorySlug: slug, limit: 48 });

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <SectionHeader
          text={`${category.productCount} ${category.productCount === 1 ? "item" : "items"} available.`}
          title={category.name}
        />
        {products.length === 0 ? (
          <EmptyState message="Nothing is listed in this category yet." title="No products" />
        ) : (
          <ProductGrid products={products} />
        )}
      </PageContainer>
    </Section>
  );
}
