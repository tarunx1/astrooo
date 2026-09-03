import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminLayout, AdminSection, AdminStatusBadge } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { ProductForm } from "@/components/admin/product-form";
import { InventoryAdjustForm } from "@/components/admin/inventory-adjust-form";
import { VariantForm } from "@/components/admin/variant-form";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminProduct } from "@/lib/admin/products";
import { listAdjustmentsFor } from "@/lib/admin/inventory";
import { formatMoneyMinor } from "@/lib/shop/pricing";

export const metadata: Metadata = { title: "Product" };

function toRupees(paise: number | null | undefined): string {
  return paise == null ? "" : (paise / 100).toString();
}

export default async function AdminProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;

  const product = await getAdminProduct(id);
  if (!product) notFound();

  const adjustments = await listAdjustmentsFor({ productId: product.id }, 10);

  return (
    <AdminLayout
      adminName={admin.name || admin.email}
      currentPath="/admin/products"
      description={product.slug}
      title={product.title}
    >
      <AdminSection title="Details">
        <Card className="p-5 sm:p-6">
          <ProductForm
            initial={{
              id: product.id,
              title: product.title,
              slug: product.slug,
              description: product.description,
              sku: product.sku ?? "",
              priceRupees: toRupees(product.pricePaise),
              salePriceRupees: toRupees(product.salePricePaise),
              active: product.active,
              imageUrls: product.images.map((image) => image.url).join("\n"),
            }}
          />
        </Card>
      </AdminSection>

      <AdminSection description="Relative changes only, each with a reason." title="Stock">
        <Card className="grid gap-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <p className="heading-sm">{product.inventory?.quantity ?? 0}</p>
            <AdminStatusBadge
              label={product.inventory?.status ?? "OUT_OF_STOCK"}
              tone={(product.inventory?.quantity ?? 0) > 0 ? "positive" : "danger"}
            />
          </div>
          <InventoryAdjustForm productId={product.id} productVariantId={null} />
        </Card>
      </AdminSection>

      <AdminSection description="Variants carry their own SKU, optional price override and their own stock." title="Variants">
        <div className="grid gap-3">
          {product.variants.length === 0 ? (
            <Card className="p-4">
              <p className="body-sm text-foreground-muted">No variants. The product is sold as a single item.</p>
            </Card>
          ) : (
            product.variants.map((variant) => (
              <Card className="grid gap-3 p-4" key={variant.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="body-sm font-semibold text-foreground">{variant.title}</p>
                    <p className="caption text-foreground-muted">
                      SKU {variant.sku}
                      {variant.pricePaise != null ? ` · ${formatMoneyMinor(variant.pricePaise)}` : " · uses product price"}
                    </p>
                  </div>
                  <AdminStatusBadge
                    label={`${variant.inventory?.quantity ?? 0} in stock`}
                    tone={(variant.inventory?.quantity ?? 0) > 0 ? "positive" : "danger"}
                  />
                </div>
                <InventoryAdjustForm productId={null} productVariantId={variant.id} />
              </Card>
            ))
          )}

          <Card className="p-5">
            <h3 className="heading-sm">Add a variant</h3>
            <div className="mt-3">
              <VariantForm productId={product.id} />
            </div>
          </Card>
        </div>
      </AdminSection>

      <AdminSection description="The ten most recent stock changes for this product." title="Stock history">
        {adjustments.length === 0 ? (
          <Card className="p-4">
            <p className="body-sm text-foreground-muted">No adjustments recorded yet.</p>
          </Card>
        ) : (
          <Card className="grid gap-2 p-5">
            {adjustments.map((adjustment) => (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0" key={adjustment.id}>
                <span className="body-sm text-foreground">
                  <span className={adjustment.delta > 0 ? "text-success" : "text-danger"}>
                    {adjustment.delta > 0 ? "+" : ""}
                    {adjustment.delta}
                  </span>{" "}
                  · {adjustment.previousQuantity} → {adjustment.newQuantity}
                </span>
                <span className="caption text-foreground-muted">
                  {adjustment.reason} · {adjustment.adminUser.email} ·{" "}
                  {adjustment.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            ))}
          </Card>
        )}
      </AdminSection>
    </AdminLayout>
  );
}
