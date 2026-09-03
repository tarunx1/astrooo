/**
 * Money and order arithmetic.
 *
 * Everything is integer minor units (paise). No float ever touches a total, and
 * no value here is ever taken from the browser: callers pass prices they have
 * just read from the database.
 */
export const CURRENCY = "INR" as const;

/** Flat India-first shipping, configurable in one place. */
export const SHIPPING_POLICY = {
  flatRatePaise: 9_900,
  freeAboveSubtotalPaise: 150_000,
} as const;

export type ShippingQuote = { shippingPaise: number; isFree: boolean; freeAbovePaise: number };

export interface ShippingCalculator {
  quote(input: { subtotalPaise: number; countryCode: string }): ShippingQuote;
}

/**
 * Flat rate with a free-shipping threshold.
 *
 * Deliberately simple: no carrier integration exists yet, and inventing zone
 * logic we cannot honour would be worse than a rate we can.
 */
export class FlatRateShippingCalculator implements ShippingCalculator {
  constructor(private readonly policy = SHIPPING_POLICY) {}

  quote({ subtotalPaise }: { subtotalPaise: number; countryCode: string }): ShippingQuote {
    const isFree = subtotalPaise >= this.policy.freeAboveSubtotalPaise;
    return {
      shippingPaise: isFree ? 0 : this.policy.flatRatePaise,
      isFree,
      freeAbovePaise: this.policy.freeAboveSubtotalPaise,
    };
  }
}

export function getShippingCalculator(): ShippingCalculator {
  return new FlatRateShippingCalculator();
}

export interface TaxCalculator {
  calculate(input: { subtotalPaise: number; discountPaise: number; shippingPaise: number }): { taxPaise: number };
}

/**
 * Tax is not configured.
 *
 * GST rules for this catalogue have not been defined, so tax is zero and the
 * checkout says so rather than displaying an invented number. This abstraction
 * exists so a real calculator can be dropped in without touching checkout.
 * THIS IS NOT A CLAIM OF TAX COMPLIANCE.
 */
export class ZeroTaxCalculator implements TaxCalculator {
  calculate(): { taxPaise: number } {
    return { taxPaise: 0 };
  }
}

export function getTaxCalculator(): TaxCalculator {
  return new ZeroTaxCalculator();
}

export const TAX_IS_CONFIGURED = false;

export type OrderTotals = {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  currency: typeof CURRENCY;
};

/**
 * Composes the final totals.
 *
 * The discount is clamped to the subtotal so a coupon can never drive a total
 * negative, and the result is asserted to be a non-negative integer.
 */
export function composeTotals(input: {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
}): OrderTotals {
  const subtotalPaise = Math.max(0, Math.trunc(input.subtotalPaise));
  const discountPaise = Math.min(Math.max(0, Math.trunc(input.discountPaise)), subtotalPaise);
  const shippingPaise = Math.max(0, Math.trunc(input.shippingPaise));
  const taxPaise = Math.max(0, Math.trunc(input.taxPaise));

  const totalPaise = subtotalPaise - discountPaise + shippingPaise + taxPaise;

  return {
    subtotalPaise,
    discountPaise,
    shippingPaise,
    taxPaise,
    totalPaise: Math.max(0, totalPaise),
    currency: CURRENCY,
  };
}

export function lineTotalPaise(unitPricePaise: number, quantity: number): number {
  return Math.trunc(unitPricePaise) * Math.trunc(quantity);
}

/**
 * Formats integer minor units for display.
 *
 * Client-safe on purpose: this module has no `server-only` and no Prisma, so a
 * client component can format money without dragging the database client into
 * the browser bundle.
 */
export function formatMoneyMinor(amountMinor: number, currency: string = CURRENCY): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}
