import "server-only";

import { getLocationProvider } from "@/lib/location/provider";
import { normalizeBirthDetails } from "@/lib/kundli/normalize";
import { birthDetailsSchema, resolvedLocationSchema } from "@/lib/kundli/schema";
import type { NormalizedBirthDetails } from "@/lib/kundli/types";

/**
 * Turns raw form data into normalized birth details.
 *
 * Uses the same canonical schema, the same LocationProvider and the same
 * normalizer as Kundli generation — the validation rules are imported, never
 * restated. `prefix` lets one submission carry two people, as Kundli matching
 * needs.
 */
export type BirthResolution =
  | { ok: true; value: NormalizedBirthDetails }
  | { ok: false; fieldErrors: Record<string, string[]>; formErrors: string[] };

function unprefix(formData: FormData, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  const keys = ["name", "gender", "dateOfBirth", "timeOfBirth", "timeAccuracy", "placeId", "displayName", "city", "region", "country"];

  for (const key of keys) {
    const field = prefix ? `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}` : key;
    const value = formData.get(field);
    if (typeof value === "string") out[key] = value;
  }

  return out;
}

/** Re-prefixes error keys so the right field lights up on a two-person form. */
function prefixErrors(errors: Record<string, string[]>, prefix: string): Record<string, string[]> {
  if (!prefix) return errors;

  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(errors)) {
    out[`${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`] = value;
  }
  return out;
}

export async function resolveBirthFromForm(formData: FormData, prefix = ""): Promise<BirthResolution> {
  const parsed = birthDetailsSchema.safeParse(unprefix(formData, prefix));

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return { ok: false, fieldErrors: prefixErrors(flattened.fieldErrors, prefix), formErrors: flattened.formErrors };
  }

  const resolved = await getLocationProvider().resolve(parsed.data.placeId);
  if (!resolved) {
    return {
      ok: false,
      formErrors: [],
      fieldErrors: prefixErrors({ placeId: ["Select a birth place from the suggestions."] }, prefix),
    };
  }

  const validation = resolvedLocationSchema.safeParse(resolved);
  if (!validation.success) {
    return {
      ok: false,
      formErrors: ["That birth place could not be resolved to calculation-ready location data."],
      fieldErrors: prefixErrors({ placeId: ["Choose a different birth place."] }, prefix),
    };
  }

  return {
    ok: true,
    value: normalizeBirthDetails({
      ...parsed.data,
      displayName: resolved.displayName,
      city: resolved.city,
      region: resolved.region ?? "",
      country: resolved.country,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      timezone: resolved.timezone,
    }),
  };
}
