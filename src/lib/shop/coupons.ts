import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * Coupon validation.
 *
 * Every rule is applied on the server against the database row. The browser
 * submits a code and nothing else: never a discount amount, never a percentage,
 * never a computed total.
 */
export type CouponEvaluation =
  | { ok: true; couponId: string; code: string; discountPaise: number }
  | { ok: false; reason: CouponRejection; message: string };

export type CouponRejection =
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "below_minimum"
  | "usage_limit"
  | "per_user_limit";

const REJECTION_MESSAGES: Record<CouponRejection, string> = {
  not_found: "That coupon code is not valid.",
  inactive: "That coupon code is not valid.",
  not_started: "This coupon is not active yet.",
  expired: "This coupon has expired.",
  below_minimum: "Your order does not meet this coupon's minimum value.",
  usage_limit: "This coupon has reached its usage limit.",
  per_user_limit: "You have already used this coupon.",
};

function reject(reason: CouponRejection): CouponEvaluation {
  return { ok: false, reason, message: REJECTION_MESSAGES[reason] };
}

/**
 * Computes the discount for a code against a subtotal.
 *
 * A percentage discount is capped by `maxDiscountPaise` when set, and every
 * result is clamped to the subtotal so a coupon can never produce a negative
 * total.
 */
export async function evaluateCoupon(input: {
  code: string;
  subtotalPaise: number;
  userId: string | null;
  now?: Date;
}): Promise<CouponEvaluation> {
  const code = input.code.trim().toUpperCase();
  if (!code) return reject("not_found");

  const coupon = await prisma.coupon.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      active: true,
      percentOff: true,
      amountOffPaise: true,
      minOrderPaise: true,
      maxDiscountPaise: true,
      usageLimit: true,
      perUserLimit: true,
      timesRedeemed: true,
      startsAt: true,
      endsAt: true,
    },
  });

  if (!coupon) return reject("not_found");
  if (!coupon.active) return reject("inactive");

  const now = input.now ?? new Date();
  if (coupon.startsAt && now < coupon.startsAt) return reject("not_started");
  if (coupon.endsAt && now > coupon.endsAt) return reject("expired");

  if (coupon.minOrderPaise !== null && input.subtotalPaise < coupon.minOrderPaise) {
    return reject("below_minimum");
  }

  if (coupon.usageLimit !== null && coupon.timesRedeemed >= coupon.usageLimit) {
    return reject("usage_limit");
  }

  if (coupon.perUserLimit !== null && input.userId) {
    const used = await prisma.couponRedemption.count({
      where: { couponId: coupon.id, userId: input.userId },
    });
    if (used >= coupon.perUserLimit) return reject("per_user_limit");
  }

  let discountPaise = 0;

  if (coupon.percentOff !== null && coupon.percentOff > 0) {
    discountPaise = Math.floor((input.subtotalPaise * coupon.percentOff) / 100);
    if (coupon.maxDiscountPaise !== null) {
      discountPaise = Math.min(discountPaise, coupon.maxDiscountPaise);
    }
  } else if (coupon.amountOffPaise !== null && coupon.amountOffPaise > 0) {
    discountPaise = coupon.amountOffPaise;
  }

  // Never exceed the subtotal, so the total can never go negative.
  discountPaise = Math.min(Math.max(0, discountPaise), input.subtotalPaise);

  if (discountPaise === 0) return reject("not_found");

  return { ok: true, couponId: coupon.id, code: coupon.code, discountPaise };
}

/**
 * Records a redemption when an order is paid.
 *
 * The unique constraint on (couponId, orderId) makes this idempotent, so a
 * duplicate payment event cannot inflate the usage counter.
 */
export async function recordCouponRedemption(
  tx: Pick<typeof prisma, "couponRedemption" | "coupon">,
  input: { couponId: string; userId: string; orderId: string },
): Promise<boolean> {
  const existing = await tx.couponRedemption.findUnique({
    where: { couponId_orderId: { couponId: input.couponId, orderId: input.orderId } },
    select: { id: true },
  });

  if (existing) return false;

  await tx.couponRedemption.create({ data: input });
  await tx.coupon.update({
    where: { id: input.couponId },
    data: { timesRedeemed: { increment: 1 } },
  });

  return true;
}
