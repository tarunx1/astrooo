"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addToCart, removeCartItem, updateCartItemQuantity, MAX_LINE_QUANTITY } from "@/lib/shop/cart";
import { resolveCartOwnerForRead, resolveCartOwnerForWrite } from "@/lib/shop/cart-session";

/**
 * Cart mutations.
 *
 * Server Actions are public endpoints, so each one validates with Zod, resolves
 * the owner from the session or the HttpOnly cookie, and re-checks the product
 * against the database. The browser submits identifiers and a quantity; never a
 * price.
 */
import type { CartActionState } from "@/lib/shop/action-state";

const idSchema = z.string().trim().min(1).max(64);

const addSchema = z.object({
  productId: idSchema,
  productVariantId: idSchema.nullable().optional(),
  quantity: z.coerce.number().int().min(1).max(MAX_LINE_QUANTITY),
});

const updateSchema = z.object({
  itemId: idSchema,
  quantity: z.coerce.number().int().min(0).max(MAX_LINE_QUANTITY),
});

function revalidateCart() {
  revalidatePath("/cart");
  revalidatePath("/checkout");
}

export async function addToCartAction(_state: CartActionState, formData: FormData): Promise<CartActionState> {
  const rawVariant = formData.get("productVariantId");
  const parsed = addSchema.safeParse({
    productId: formData.get("productId"),
    productVariantId: rawVariant && String(rawVariant).length > 0 ? rawVariant : null,
    quantity: formData.get("quantity") ?? 1,
  });

  if (!parsed.success) {
    return { error: "That item could not be added to your cart.", ok: false };
  }

  const owner = await resolveCartOwnerForWrite();
  const result = await addToCart(owner, {
    productId: parsed.data.productId,
    productVariantId: parsed.data.productVariantId ?? null,
    quantity: parsed.data.quantity,
  });

  if (!result.ok) return { error: result.message, ok: false };

  revalidateCart();
  return { error: null, ok: true };
}

export async function updateCartItemAction(_state: CartActionState, formData: FormData): Promise<CartActionState> {
  const parsed = updateSchema.safeParse({
    itemId: formData.get("itemId"),
    quantity: formData.get("quantity"),
  });

  if (!parsed.success) return { error: `Choose a quantity between 0 and ${MAX_LINE_QUANTITY}.`, ok: false };

  const owner = await resolveCartOwnerForRead();
  if (!owner) return { error: "Your cart could not be found.", ok: false };

  const result = await updateCartItemQuantity(owner, parsed.data);
  if (!result.ok) return { error: result.message, ok: false };

  revalidateCart();
  return { error: null, ok: true };
}

export async function removeCartItemAction(_state: CartActionState, formData: FormData): Promise<CartActionState> {
  const parsed = idSchema.safeParse(formData.get("itemId"));
  if (!parsed.success) return { error: "That cart item could not be found.", ok: false };

  const owner = await resolveCartOwnerForRead();
  if (!owner) return { error: "Your cart could not be found.", ok: false };

  const result = await removeCartItem(owner, parsed.data);
  if (!result.ok) return { error: result.message, ok: false };

  revalidateCart();
  return { error: null, ok: true };
}
