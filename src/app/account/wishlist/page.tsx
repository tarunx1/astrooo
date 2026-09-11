import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { AccountLayout } from "@/components/account/account-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { WishlistActions } from "@/components/shop/wishlist-actions";
import { requireUser } from "@/lib/auth/session";
import { listWishlist } from "@/lib/account/wishlist";
import { formatMoneyMinor } from "@/lib/shop/pricing";

export const metadata: Metadata = {
  title: "My Wishlist",
  robots: { index: false, follow: false },
};

/**
 * The customer's saved items.
 *
 * Prices and stock are read live from the product rather than from the saved
 * row, so a customer never sees a price that has since changed. An item that
 * has been delisted stays on the list but is marked unavailable rather than
 * silently disappearing.
 */
export default async function WishlistPage() {
  const user = await requireUser("/account/wishlist");
  const items = await listWishlist(user.id);

  return (
    <AccountLayout
      currentPath="/account/wishlist"
      description="Items you have saved. Prices and availability are shown as they are now."
      eyebrow="My account"
      title="Wishlist"
    >
      {items.length === 0 ? (
        <div className="grid gap-4">
          <EmptyState message="You have not saved anything yet." title="Nothing saved" />
          <Link
            className="mx-auto inline-flex min-h-11 items-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            href="/shop"
          >
            Browse the store
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <article className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                  {item.imageUrl ? (
                    <Image alt="" className="size-full object-cover" height={160} src={item.imageUrl} width={160} />
                  ) : (
                    <span aria-hidden="true" className="grid size-full place-items-center text-slate-300">
                      <Sparkles size={20} />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="body-sm font-semibold text-slate-900">
                    {item.available ? (
                      <Link className="underline-offset-2 hover:underline" href={`/product/${item.slug}`}>
                        {item.title}
                      </Link>
                    ) : (
                      item.title
                    )}
                  </h2>

                  <p className="mt-1 flex flex-wrap items-baseline gap-2">
                    <span className="body-sm font-semibold text-slate-900">
                      {formatMoneyMinor(item.priceMinor, item.currency)}
                    </span>
                    {item.compareAtPriceMinor ? (
                      <span className="caption text-slate-400 line-through">
                        {formatMoneyMinor(item.compareAtPriceMinor, item.currency)}
                      </span>
                    ) : null}
                  </p>

                  <p className="mt-1 caption text-slate-500">
                    {!item.available
                      ? "No longer available"
                      : item.inStock
                        ? "In stock"
                        : "Out of stock"}
                  </p>
                </div>

                <WishlistActions
                  canMoveToCart={item.available && item.inStock}
                  productId={item.productId}
                />
              </article>
            </li>
          ))}
        </ul>
      )}
    </AccountLayout>
  );
}
