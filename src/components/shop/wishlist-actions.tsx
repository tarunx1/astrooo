"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingCart, Trash2 } from "lucide-react";
import { moveToCartAction, toggleWishlistAction } from "@/app/account/wishlist/actions";

/**
 * Row actions on the wishlist.
 *
 * "Move to cart" removes the saved item only after the cart write succeeds, so
 * a rejected add - out of stock, say - leaves the item still saved rather than
 * losing it to a failed operation.
 */
export function WishlistActions({
  productId,
  canMoveToCart,
}: {
  productId: string;
  canMoveToCart: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(operation: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await operation();
      if (!result.ok) {
        setError(result.message ?? "That could not be completed.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canMoveToCart ? (
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
            disabled={pending}
            onClick={() => run(() => moveToCartAction(productId))}
            type="button"
          >
            {pending ? (
              <Loader2 aria-hidden="true" className="animate-spin" size={15} />
            ) : (
              <ShoppingCart aria-hidden="true" size={15} />
            )}
            Move to cart
          </button>
        ) : null}

        <button
          aria-label="Remove from wishlist"
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
          disabled={pending}
          onClick={() => run(() => toggleWishlistAction(productId, true))}
          type="button"
        >
          <Trash2 aria-hidden="true" size={15} />
          Remove
        </button>
      </div>

      <div aria-live="polite">
        {error ? (
          <p className="caption text-rose-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
