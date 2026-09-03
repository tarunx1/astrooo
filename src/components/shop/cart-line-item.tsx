"use client";

import { useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Sparkles, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatMoneyMinor } from "@/lib/shop/pricing";
import { removeCartItemAction, updateCartItemAction } from "@/app/cart/actions";
import { INITIAL_CART_STATE } from "@/lib/shop/action-state";
import type { CartLine } from "@/lib/shop/cart";

/**
 * One cart line, laid out as a card rather than a table row so it stays legible
 * at 375px without horizontal scrolling. Quantity controls are real buttons in a
 * labelled group, and every change is announced through the live region below.
 */
export function CartLineItem({ line, currency }: { line: CartLine; currency: string }) {
  const [quantityState, quantityAction, quantityPending] = useActionState(updateCartItemAction, INITIAL_CART_STATE);
  const [removeState, removeAction, removePending] = useActionState(removeCartItemAction, INITIAL_CART_STATE);

  const error = quantityState.error ?? removeState.error;
  const canIncrease = line.quantity < line.availableQuantity;

  return (
    <Card className="p-4">
      <div className="flex gap-4">
        <Link
          className="shrink-0 overflow-hidden rounded-md border border-border bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
          href={`/product/${line.slug}`}
          prefetch={false}
        >
          {line.imageUrl ? (
            <Image alt="" className="size-20 object-cover sm:size-24" height={96} src={line.imageUrl} width={96} />
          ) : (
            <span aria-hidden="true" className="grid size-20 place-items-center text-foreground-muted sm:size-24">
              <Sparkles size={20} />
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="heading-sm">
                <Link
                  className="line-clamp-2 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                  href={`/product/${line.slug}`}
                  prefetch={false}
                >
                  {line.title}
                </Link>
              </h3>
              {line.variantTitle ? <p className="mt-0.5 caption text-foreground-muted">{line.variantTitle}</p> : null}
              <p className="mt-1 body-sm text-foreground-secondary">
                {formatMoneyMinor(line.unitPricePaise, currency)} each
              </p>
            </div>

            <p className="shrink-0 text-sm font-semibold text-foreground">
              {formatMoneyMinor(line.lineTotalPaise, currency)}
            </p>
          </div>

          {!line.inStock ? (
            <p className="mt-2 caption text-danger">Out of stock. Remove this item to continue.</p>
          ) : line.exceedsStock ? (
            <p className="mt-2 caption text-warning">
              Only {line.availableQuantity} available. Reduce the quantity to continue.
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div aria-label={`Quantity for ${line.title}`} className="flex items-center rounded-md border border-border" role="group">
              <form action={quantityAction}>
                <input name="itemId" type="hidden" value={line.itemId} />
                <input name="quantity" type="hidden" value={Math.max(1, line.quantity - 1)} />
                <button
                  aria-label={`Decrease quantity of ${line.title}`}
                  className="grid size-9 place-items-center rounded-l-md text-foreground-muted transition hover:bg-surface-hover hover:text-foreground disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                  disabled={quantityPending || line.quantity <= 1}
                  type="submit"
                >
                  <Minus aria-hidden="true" size={14} />
                </button>
              </form>

              <span aria-live="polite" className="min-w-9 px-1 text-center text-sm font-semibold text-foreground">
                {line.quantity}
              </span>

              <form action={quantityAction}>
                <input name="itemId" type="hidden" value={line.itemId} />
                <input name="quantity" type="hidden" value={line.quantity + 1} />
                <button
                  aria-label={`Increase quantity of ${line.title}`}
                  className="grid size-9 place-items-center rounded-r-md text-foreground-muted transition hover:bg-surface-hover hover:text-foreground disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                  disabled={quantityPending || !canIncrease}
                  type="submit"
                >
                  <Plus aria-hidden="true" size={14} />
                </button>
              </form>
            </div>

            <form action={removeAction}>
              <input name="itemId" type="hidden" value={line.itemId} />
              <button
                aria-label={`Remove ${line.title} from cart`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold text-foreground-muted transition hover:bg-surface-hover hover:text-danger disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                disabled={removePending}
                type="submit"
              >
                <Trash2 aria-hidden="true" size={14} />
                {removePending ? "Removing..." : "Remove"}
              </button>
            </form>
          </div>

          {error ? (
            <p className="mt-2 caption text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
