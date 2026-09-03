"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { addToCartAction } from "@/app/cart/actions";
import { INITIAL_CART_STATE } from "@/lib/shop/action-state";
import { cn } from "@/lib/utils";

/**
 * Add to cart.
 *
 * The disabled state and stock hints here are advisory only: the server
 * re-validates the product, the variant, the quantity and current stock on every
 * submission, so a tampered form cannot add an unavailable item.
 */
type Variant = { id: string; title: string; priceMinor: number; inStock: boolean };

export function AddToCart({
  productId,
  variants,
  inStock,
  availableQuantity,
  maxQuantity = 20,
}: {
  productId: string;
  variants: Variant[];
  inStock: boolean;
  availableQuantity: number;
  maxQuantity?: number;
}) {
  const [state, formAction, pending] = useActionState(addToCartAction, INITIAL_CART_STATE);
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState(variants.find((variant) => variant.inStock)?.id ?? variants[0]?.id ?? "");

  const selectedVariant = variants.find((variant) => variant.id === variantId) ?? null;
  const purchasable = variants.length > 0 ? Boolean(selectedVariant?.inStock) : inStock;
  const ceiling = Math.max(1, Math.min(maxQuantity, variants.length > 0 ? maxQuantity : availableQuantity || maxQuantity));

  return (
    <form action={formAction} className="grid gap-4">
      <input name="productId" type="hidden" value={productId} />
      <input name="productVariantId" type="hidden" value={variantId} />
      <input name="quantity" type="hidden" value={quantity} />

      {variants.length > 0 ? (
        <fieldset className="grid gap-2">
          <legend className="caption text-foreground-secondary">Options</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => (
              <button
                aria-pressed={variant.id === variantId}
                className={cn(
                  "min-h-10 rounded-md border px-3.5 py-2 text-sm font-medium transition",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
                  variant.id === variantId
                    ? "border-primary bg-surface-raised text-foreground"
                    : "border-border bg-surface text-foreground-secondary hover:border-border-strong",
                  !variant.inStock && "opacity-50",
                )}
                disabled={!variant.inStock}
                key={variant.id}
                onClick={() => setVariantId(variant.id)}
                type="button"
              >
                {variant.title}
                {!variant.inStock ? " — sold out" : ""}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div aria-label="Quantity" className="flex items-center rounded-md border border-border" role="group">
          <button
            aria-label="Decrease quantity"
            className="grid size-11 place-items-center rounded-l-md text-foreground-muted transition hover:bg-surface-hover hover:text-foreground disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
            disabled={quantity <= 1}
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            type="button"
          >
            <Minus aria-hidden="true" size={15} />
          </button>
          <span aria-live="polite" className="min-w-10 px-1 text-center text-sm font-semibold text-foreground">
            {quantity}
          </span>
          <button
            aria-label="Increase quantity"
            className="grid size-11 place-items-center rounded-r-md text-foreground-muted transition hover:bg-surface-hover hover:text-foreground disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
            disabled={quantity >= ceiling}
            onClick={() => setQuantity((value) => Math.min(ceiling, value + 1))}
            type="button"
          >
            <Plus aria-hidden="true" size={15} />
          </button>
        </div>

        <button
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md bg-premium px-6 py-3 text-base font-semibold text-background shadow-[var(--shadow-md)] transition hover:opacity-95 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan sm:flex-none"
          disabled={pending || !purchasable}
          type="submit"
        >
          <ShoppingBag aria-hidden="true" size={18} />
          {pending ? "Adding..." : purchasable ? "Add to Cart" : "Out of stock"}
        </button>
      </div>

      <div aria-live="polite" className="min-h-5">
        {state.error ? (
          <p className="caption text-danger" role="alert">
            {state.error}
          </p>
        ) : state.ok ? (
          <p className="inline-flex items-center gap-1.5 caption text-success">
            <Check aria-hidden="true" size={14} />
            Added to your cart.{" "}
            <Link className="font-semibold underline underline-offset-4" href="/cart" prefetch={false}>
              View cart
            </Link>
          </p>
        ) : null}
      </div>
    </form>
  );
}
