import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, PackageCheck, PackageX, ShieldCheck, Sparkles, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PriceDisplay as UiPriceDisplay } from "@/components/ui/price-display";
import { cn } from "@/lib/utils";
import { formatMoneyMinor, type ProductCardData } from "@/lib/shop/catalog";
import type { Certification, Specification } from "@/lib/shop/attributes";

/** Money renders only here, from integer minor units. */
export function PriceDisplay({
  priceMinor,
  compareAtPriceMinor,
  currency,
  size = "md",
}: {
  priceMinor: number;
  compareAtPriceMinor?: number | null;
  currency: string;
  size?: "sm" | "md" | "lg";
}) {
  const amount = formatMoneyMinor(priceMinor, currency);
  const compareAt = compareAtPriceMinor ? formatMoneyMinor(compareAtPriceMinor, currency) : null;
  const discountLabel = compareAtPriceMinor
    ? `${Math.round(((compareAtPriceMinor - priceMinor) / compareAtPriceMinor) * 100)}% off`
    : null;

  return (
    <UiPriceDisplay
      amount={amount}
      compareAt={compareAt}
      discountLabel={discountLabel}
      size={size}
    />
  );
}

export function InventoryBadge({ inStock, quantity }: { inStock: boolean; quantity?: number }) {
  if (!inStock) {
    return (
      <span className="inline-flex items-center gap-1.5 caption text-foreground-muted">
        <PackageX aria-hidden="true" size={14} />
        Out of stock
      </span>
    );
  }

  const low = quantity !== undefined && quantity > 0 && quantity <= 3;

  return (
    <span className={cn("inline-flex items-center gap-1.5 caption", low ? "text-warning" : "text-success")}>
      <PackageCheck aria-hidden="true" size={14} />
      {low ? `Only ${quantity} left` : "In stock"}
    </span>
  );
}

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <Card className="group overflow-hidden" variant="interactive">
      <Link className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan" href={`/product/${product.slug}`} prefetch={false}>
        <div className="relative aspect-square overflow-hidden bg-surface-raised">
          {product.imageUrl ? (
            <Image
              alt={product.imageAlt}
              className="size-full object-cover transition duration-[var(--motion-normal)] group-hover:scale-105"
              height={480}
              src={product.imageUrl}
              width={480}
            />
          ) : (
            <div aria-hidden="true" className="grid size-full place-items-center text-foreground-muted">
              <Sparkles size={28} />
            </div>
          )}
          {product.certified ? (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-premium/60 bg-background/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-premium backdrop-blur">
              <BadgeCheck size={12} />
              Certified
            </span>
          ) : null}
        </div>

        <div className="p-4">
          {product.categoryName ? <p className="caption text-foreground-muted">{product.categoryName}</p> : null}
          <h3 className="mt-1 heading-sm line-clamp-2 text-foreground">{product.title}</h3>
          <div className="mt-3">
            <PriceDisplay
              compareAtPriceMinor={product.compareAtPriceMinor}
              currency={product.currency}
              priceMinor={product.priceMinor}
              size="sm"
            />
          </div>
          <div className="mt-2">
            <InventoryBadge inStock={product.inStock} />
          </div>
        </div>
      </Link>
    </Card>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

/** Verifiable physical facts only. Traditional associations are shown apart. */
export function ProductSpecifications({ specifications }: { specifications: Specification[] }) {
  if (specifications.length === 0) return null;

  return (
    <section aria-labelledby="specifications-heading">
      <h2 className="heading-md" id="specifications-heading">
        Specifications
      </h2>
      <p className="mt-1.5 body-sm text-foreground-secondary">Measured physical properties of this item.</p>
      <dl className="mt-4 overflow-hidden rounded-lg border border-border">
        {specifications.map((spec, index) => (
          <div
            className={cn(
              "flex flex-wrap gap-2 px-4 py-3",
              index % 2 === 0 ? "bg-surface" : "bg-surface-raised",
            )}
            key={spec.label}
          >
            <dt className="w-40 shrink-0 body-sm text-foreground-muted">{spec.label}</dt>
            <dd className="body-sm text-foreground">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function CertificationPanel({
  certification,
  traditionalUse,
}: {
  certification: Certification | null;
  traditionalUse: string | null;
}) {
  if (!certification && !traditionalUse) return null;

  return (
    <div className="grid gap-4">
      {certification ? (
        <Card className="p-5" variant={certification.certified ? "premium" : "default"}>
          <div className="flex items-start gap-3">
            <ShieldCheck aria-hidden="true" className={certification.certified ? "text-premium" : "text-foreground-muted"} size={20} />
            <div>
              <h3 className="heading-sm">
                {certification.certified ? "Lab certified" : "Certification not provided"}
              </h3>
              {certification.certified ? (
                <p className="mt-1.5 body-sm text-foreground-secondary">
                  {certification.lab ? `Certified by ${certification.lab}.` : "A certificate is supplied with this item."}
                  {certification.certificateNumber ? ` Certificate ${certification.certificateNumber}.` : ""} The
                  certificate ships with your order.
                </p>
              ) : (
                <p className="mt-1.5 body-sm text-foreground-secondary">
                  This item is sold without an independent lab certificate.
                </p>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      {traditionalUse ? (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <Sparkles aria-hidden="true" className="text-accent-cyan" size={20} />
            <div>
              <h3 className="heading-sm">Traditional association</h3>
              <p className="mt-1.5 body-sm text-foreground-secondary">
                In Vedic tradition this item is associated with {traditionalUse}. This is a traditional belief, not a
                verified physical property, and it is not a medical or financial claim.
              </p>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export function ReviewSummary({ count, average }: { count: number; average: number | null }) {
  if (count === 0) {
    return <p className="caption text-foreground-muted">No reviews yet</p>;
  }

  return (
    <p className="flex items-center gap-2">
      <span aria-hidden="true" className="flex items-center gap-0.5 text-premium">
        {Array.from({ length: 5 }, (_, index) => (
          <Star fill={average !== null && index < Math.round(average) ? "currentColor" : "none"} key={index} size={14} />
        ))}
      </span>
      <span className="body-sm text-foreground-secondary">
        {average} out of 5 · {count} {count === 1 ? "review" : "reviews"}
      </span>
    </p>
  );
}

export function RelatedProducts({ products }: { products: ProductCardData[] }) {
  if (products.length === 0) return null;

  return (
    <section aria-labelledby="related-heading">
      <h2 className="heading-md" id="related-heading">
        You may also like
      </h2>
      <div className="mt-4">
        <ProductGrid products={products} />
      </div>
    </section>
  );
}
