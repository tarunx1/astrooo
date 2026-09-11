import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductType } from "@prisma/client";
import { AdminLayout } from "@/components/admin/admin-shell";
import { DashboardSection, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { GemstoneForm, type GemstoneFormValues } from "@/components/admin/gemstone-form";
import { AdminForm } from "@/components/admin/admin-form";
import { requirePermission } from "@/lib/auth/access";
import { getAdminProduct } from "@/lib/admin/products";
import { parseProductAttributes } from "@/lib/shop/attributes";
import { prisma } from "@/lib/db/prisma";
import { setGemstoneActiveAction } from "@/app/admin/gemstones/actions";

export const metadata: Metadata = { title: "Gemstone" };

/**
 * One gemstone.
 *
 * Stored attributes are parsed through the shop's own schema, so a row written
 * before a field existed renders as a gap rather than throwing - the catalogue
 * has to keep working while its shape evolves.
 */
export default async function AdminGemstoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePermission("gemstones.manage");
  const { id } = await params;

  const gemstone = await prisma.product.findFirst({
    where: { id, type: ProductType.GEMSTONE },
    select: { id: true },
  });

  if (!gemstone) notFound();

  const product = await getAdminProduct(gemstone.id);
  if (!product) notFound();

  const attributes = parseProductAttributes(product.attributes);
  const stone = attributes?.kind === "GEMSTONE" ? attributes : null;

  const initial: GemstoneFormValues = {
    id: product.id,
    title: product.title,
    slug: product.slug,
    description: product.description,
    sku: product.sku ?? "",
    priceRupees: (product.pricePaise / 100).toFixed(2),
    salePriceRupees: product.salePricePaise ? (product.salePricePaise / 100).toFixed(2) : "",
    active: product.active,
    imageUrls: product.images.map((image) => image.url).join("\n"),
    gemstoneType: stone?.gemstoneType ?? "",
    carat: stone ? String(stone.carat) : "",
    weightGrams: stone?.weightGrams ? String(stone.weightGrams) : "",
    origin: stone?.origin ?? "",
    treatment: stone?.treatment ?? "",
    color: stone?.color ?? "",
    clarity: stone?.clarity ?? "",
    cut: stone?.cut ?? "",
    dimensionsMm: stone?.dimensionsMm ?? "",
    certified: stone?.certified ?? false,
    certificationLab: stone?.certificationLab ?? "",
    certificateNumber: stone?.certificateNumber ?? "",
    traditionalPlanet: stone?.traditionalPlanet ?? "",
    careInstructions: stone?.careInstructions ?? "",
  };

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/gemstones"
      description={`${product.inventory?.quantity ?? 0} in stock · adjust stock from the Inventory screen`}
      title={product.title}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <DashboardSection title="Details">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <GemstoneForm initial={initial} />
          </div>
        </DashboardSection>

        <div className="grid gap-4 self-start">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <p className="caption font-semibold uppercase tracking-wider text-slate-500">Listing</p>
            <div className="mt-2">
              <StatusBadge
                label={product.active ? "Listed" : "Archived"}
                tone={product.active ? "positive" : "neutral"}
              />
            </div>
            <div className="mt-4">
              <AdminForm
                action={setGemstoneActiveAction}
                confirm={
                  product.active
                    ? "Archive this gemstone? It disappears from the shop; past orders are unchanged."
                    : undefined
                }
                pendingLabel="Saving..."
                submitLabel={product.active ? "Archive" : "Restore"}
                variant={product.active ? "danger" : "secondary"}
              >
                <input name="productId" type="hidden" value={product.id} />
                <input name="active" type="hidden" value={product.active ? "false" : "true"} />
              </AdminForm>
            </div>
            <p className="mt-3 caption text-slate-500">
              Archiving never deletes. Orders reference the product, and history that points at a deleted row
              is not history.
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
