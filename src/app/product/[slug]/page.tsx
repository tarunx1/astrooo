import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer, Section } from "@/components/layout/primitives";
import { AddToCart } from "@/components/shop/add-to-cart";
import { ProductGallery } from "@/components/shop/product-gallery";
import {
  CertificationPanel,
  InventoryBadge,
  PriceDisplay,
  ProductSpecifications,
  RelatedProducts,
  ReviewSummary,
} from "@/components/shop/product-primitives";
import { Card } from "@/components/ui/card";
import { getProductBySlug, listRelatedProducts } from "@/lib/shop/catalog";
import { brand } from "@/config/brand";
import { getCspNonce } from "@/lib/security/nonce";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };

  return {
    title: `${product.title} | Ravish Astro`,
    description: product.description.slice(0, 155),
    alternates: { canonical: `${brand.url}/product/${product.slug}` },
    openGraph: {
      title: product.title,
      description: product.description.slice(0, 155),
      images: product.imageUrl ? [product.imageUrl] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Params) {
  const nonce = await getCspNonce();
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await listRelatedProducts(product.id, product.categorySlug);

  // Structured data describes the verified commercial facts only.
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    sku: product.sku ?? undefined,
    image: product.images.map((image) => image.url),
    offers: {
      "@type": "Offer",
      price: (product.priceMinor / 100).toFixed(2),
      priceCurrency: product.currency,
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${brand.url}/product/${product.slug}`,
    },
    ...(product.averageRating !== null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.averageRating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shop", item: `${brand.url}/shop` },
      ...(product.categorySlug && product.categoryName
        ? [{ "@type": "ListItem", position: 2, name: product.categoryName, item: `${brand.url}/shop/${product.categorySlug}` }]
        : []),
      { "@type": "ListItem", position: product.categorySlug ? 3 : 2, name: product.title },
    ],
  };

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
          type="application/ld+json"
        />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
          type="application/ld+json"
        />

        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-2 caption text-foreground-muted">
            <li>
              <Link className="hover:text-foreground" href="/shop" prefetch={false}>
                Shop
              </Link>
            </li>
            {product.categorySlug && product.categoryName ? (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link className="hover:text-foreground" href={`/shop/${product.categorySlug}`} prefetch={false}>
                    {product.categoryName}
                  </Link>
                </li>
              </>
            ) : null}
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-foreground-secondary">
              {product.title}
            </li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <ProductGallery images={product.images} title={product.title} />

          <div className="grid content-start gap-5">
            {product.categoryName ? <p className="caption text-foreground-muted">{product.categoryName}</p> : null}
            <h1 className="heading-xl">{product.title}</h1>

            <ReviewSummary average={product.averageRating} count={product.reviewCount} />

            <PriceDisplay
              compareAtPriceMinor={product.compareAtPriceMinor}
              currency={product.currency}
              priceMinor={product.priceMinor}
              size="lg"
            />

            <InventoryBadge inStock={product.inStock} quantity={product.quantityAvailable} />

            <p className="body-md text-foreground-secondary">{product.description}</p>

            <AddToCart
              availableQuantity={product.quantityAvailable}
              inStock={product.inStock}
              productId={product.id}
              variants={product.variants.map((variant) => ({
                id: variant.id,
                title: variant.title,
                priceMinor: variant.priceMinor,
                inStock: variant.inStock,
              }))}
            />

            <CertificationPanel certification={product.certification} traditionalUse={product.traditionalUse} />
          </div>
        </div>

        <div className="mt-12 grid gap-10">
          <ProductSpecifications specifications={product.specifications} />

          {product.careInstructions ? (
            <section aria-labelledby="care-heading">
              <h2 className="heading-md" id="care-heading">
                Care
              </h2>
              <p className="mt-3 body-md text-foreground-secondary">{product.careInstructions}</p>
            </section>
          ) : null}

          <section aria-labelledby="shipping-heading">
            <h2 className="heading-md" id="shipping-heading">
              Shipping and returns
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <h3 className="heading-sm">Shipping</h3>
                <p className="mt-2 body-sm text-foreground-secondary">
                  Dispatched from India with tracking. Certified items ship with their certificate.
                </p>
              </Card>
              <Card className="p-5">
                <h3 className="heading-sm">Returns</h3>
                <p className="mt-2 body-sm text-foreground-secondary">
                  Returnable in original condition within 7 days of delivery. Energised and made-to-order items are
                  excluded.
                </p>
              </Card>
            </div>
          </section>

          <RelatedProducts products={related} />
        </div>
      </PageContainer>
    </Section>
  );
}
