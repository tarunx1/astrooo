"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { findActiveCart } from "@/lib/shop/cart";
import { shippingAddressSchema } from "@/lib/shop/address";
import { createOrderFromCart } from "@/lib/shop/orders";
import { verifyCheckoutPaymentForOrder } from "@/lib/shop/payment-verification";

/**
 * Checkout.
 *
 * Authenticated only. The browser submits an address and an optional coupon
 * code; every price, discount, shipping charge and total is computed on the
 * server from the database.
 */
import type { CheckoutState, VerifyState } from "@/lib/shop/action-state";

export async function placeOrderAction(_state: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Please sign in to complete your order.", fieldErrors: {}, order: null };
  }

  const address = shippingAddressSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2") ?? "",
    city: formData.get("city"),
    region: formData.get("region"),
    postalCode: formData.get("postalCode"),
    country: formData.get("country") ?? "IN",
  });

  if (!address.success) {
    return { error: null, fieldErrors: address.error.flatten().fieldErrors, order: null };
  }

  const cart = await findActiveCart({ userId: user.id });
  if (!cart) return { error: "Your cart is empty.", fieldErrors: {}, order: null };

  const couponRaw = formData.get("couponCode");
  const couponCode = typeof couponRaw === "string" && couponRaw.trim() ? couponRaw.trim() : null;

  const result = await createOrderFromCart({
    userId: user.id,
    cartId: cart.id,
    address: address.data,
    couponCode,
  });

  if (!result.ok) {
    return { error: result.message, fieldErrors: {}, order: null };
  }

  revalidatePath("/account/orders");

  return {
    error: null,
    fieldErrors: {},
    order: {
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      providerOrderId: result.providerOrderId,
      amountMinor: result.amountMinor,
      currency: result.currency,
    },
  };
}

const verifySchema = z.object({
  orderId: z.string().trim().min(1).max(64),
  providerOrderId: z.string().trim().min(1).max(128),
  providerPaymentId: z.string().trim().min(1).max(128),
  signature: z.string().trim().min(1).max(256),
});

/**
 * Records the browser's checkout callback.
 *
 * The signature is verified server-side with the existing Razorpay
 * implementation. This is a convenience path so the customer sees a result
 * immediately; the webhook remains the authoritative source, and an order is
 * never marked paid on an unverified browser claim.
 */
export async function verifyOrderPaymentAction(_state: VerifyState, formData: FormData): Promise<VerifyState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Please sign in again.", verified: false, orderId: null };

  const parsed = verifySchema.safeParse({
    orderId: formData.get("orderId"),
    providerOrderId: formData.get("providerOrderId"),
    providerPaymentId: formData.get("providerPaymentId"),
    signature: formData.get("signature"),
  });

  if (!parsed.success) return { error: "Payment could not be verified.", verified: false, orderId: null };

  const outcome = await verifyCheckoutPaymentForOrder({ userId: user.id, ...parsed.data });

  if (!outcome.ok) return { error: outcome.message, verified: false, orderId: parsed.data.orderId };

  revalidatePath("/account/orders");
  revalidatePath("/cart");

  return { error: null, verified: true, orderId: parsed.data.orderId };
}
