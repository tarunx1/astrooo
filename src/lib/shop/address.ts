import { z } from "zod";

/**
 * Shipping address.
 *
 * India-first. Validated with Zod on the server; browser validation is a
 * convenience only and is never trusted.
 */
export const shippingAddressSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the recipient's full name.").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[-\s]?)?[6-9]\d{9}$/, "Enter a valid Indian mobile number."),
  addressLine1: z.string().trim().min(4, "Enter the street address.").max(180),
  addressLine2: z.string().trim().max(180).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Enter the city.").max(80),
  region: z.string().trim().min(2, "Enter the state.").max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code."),
  country: z.string().trim().length(2, "Select a country.").default("IN"),
});

export type ShippingAddressInput = z.input<typeof shippingAddressSchema>;
export type ShippingAddress = z.output<typeof shippingAddressSchema>;

/**
 * The immutable copy stored on an Order.
 *
 * Orders keep their own address rather than pointing at the mutable Address
 * record, so editing a saved address later never rewrites where a past order
 * was actually shipped.
 */
export function toAddressSnapshot(address: ShippingAddress): Record<string, string> {
  return {
    fullName: address.fullName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 ?? "",
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    country: address.country,
  };
}

export function formatAddressSnapshot(snapshot: unknown): string[] {
  const parsed = shippingAddressSchema.partial().safeParse(snapshot);
  if (!parsed.success) return [];

  const value = parsed.data;
  return [
    value.fullName,
    value.addressLine1,
    value.addressLine2 || undefined,
    [value.city, value.region, value.postalCode].filter(Boolean).join(", "),
    value.country,
    value.phone,
  ].filter((line): line is string => Boolean(line && line.trim()));
}
