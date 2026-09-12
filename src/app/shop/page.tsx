import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { PageContainer, Section, SectionHeader } from "@/components/layout/primitives";
import { ProductGrid } from "@/components/shop/product-primitives";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { listProducts, listShopCategories } from "@/lib/shop/catalog";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Spiritual Store | Gemstones, Rudraksha & Crystals",
  description:
    "Certified gemstones, Rudraksha, crystals, bracelets and yantras. Every item lists its verified specifications, origin and certification.",
  alternates: { canonical: `${brand.url}/shop` },
};

export default async function ShopPage() {
  const [categories, products] = await Promise.all([listShopCategories(), listProducts({ limit: 24 })]);

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <SectionHeader
          text="Certified stones and traditional spiritual items. Every listing shows its measured specifications and certification separately from traditional association, so you know exactly what you are buying."
          title="Spiritual Store"
        />

        {categories.length > 0 ? (
          <nav aria-label="Product categories" className="mb-8">
            <ul className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground-secondary transition hover:border-primary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                    href={`/shop/${category.slug}`}
                    prefetch={false}
                  >
                    {category.name}
                    <Badge>{category.productCount}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {products.length === 0 ? (
          <EmptyState
            icon={<PackageSearch aria-hidden="true" size={20} />}
            message="Our store is being prepared. Please check back shortly."
            title="No products listed yet"
          />
        ) : (
          <ProductGrid products={products} />
        )}
      </PageContainer>
    </Section>
  );
}
