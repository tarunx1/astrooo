/**
 * Form-action state shapes and their initial values.
 *
 * These live outside the `"use server"` files deliberately: such a file may only
 * export async functions, so exporting a constant from one breaks the module at
 * runtime even though it typechecks cleanly.
 */
export type CartActionState = { error: string | null; ok: boolean };

export const INITIAL_CART_STATE: CartActionState = { error: null, ok: false };

export type CheckoutState = {
  error: string | null;
  fieldErrors: Record<string, string[]>;
  order: {
    orderId: string;
    orderNumber: string;
    providerOrderId: string;
    amountMinor: number;
    currency: string;
  } | null;
};

export const INITIAL_CHECKOUT_STATE: CheckoutState = { error: null, fieldErrors: {}, order: null };

export type VerifyState = { error: string | null; verified: boolean; orderId: string | null };

export const INITIAL_VERIFY_STATE: VerifyState = { error: null, verified: false, orderId: null };

export type SaveKundliState = { error: string | null; saved: boolean };

export const INITIAL_SAVE_STATE: SaveKundliState = { error: null, saved: false };
