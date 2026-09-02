import { getAstrologyProvider } from "@/lib/astrology/provider";
import { isAstrologyProviderError } from "@/lib/astrology/errors";
import { getLocationProvider } from "@/lib/location/provider";
import { createKundliInputHash, normalizeBirthDetails } from "@/lib/kundli/normalize";
import type { BirthDetailsInput } from "@/lib/kundli/schema";
import { birthDetailsSchema, resolvedLocationSchema } from "@/lib/kundli/schema";
import { findKundliByHash, findKundliById, persistKundliCalculation } from "@/lib/kundli/store";

export type KundliGenerationResult =
  | { ok: true; id: string }
  | { ok: false; formErrors: string[]; fieldErrors: Record<string, string[]> };

export async function generateKundli(input: BirthDetailsInput): Promise<KundliGenerationResult> {
  const parsed = birthDetailsSchema.safeParse(input);
  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return {
      ok: false,
      formErrors: flattened.formErrors,
      fieldErrors: flattened.fieldErrors,
    };
  }

  const locationProvider = getLocationProvider();
  const resolvedLocation = await locationProvider.resolve(parsed.data.placeId);
  if (!resolvedLocation) {
    return {
      ok: false,
      formErrors: [],
      fieldErrors: { placeId: ["Select a resolved birth place from the suggestions."] },
    };
  }
  const locationValidation = resolvedLocationSchema.safeParse(resolvedLocation);
  if (!locationValidation.success) {
    return {
      ok: false,
      formErrors: ["The selected birth place could not be resolved to calculation-ready location data."],
      fieldErrors: { placeId: ["Choose a different resolved birth place."] },
    };
  }

  const normalized = normalizeBirthDetails({
    ...parsed.data,
    displayName: resolvedLocation.displayName,
    city: resolvedLocation.city,
    region: resolvedLocation.region ?? "",
    country: resolvedLocation.country,
    latitude: resolvedLocation.latitude,
    longitude: resolvedLocation.longitude,
    timezone: resolvedLocation.timezone,
  });
  const inputHash = createKundliInputHash(normalized);
  const cached = await findKundliByHash(inputHash);
  if (cached) {
    console.info("kundli_calculation_cache", {
      provider: cached.result.calculationMetadata.provider,
      operation: "JANAM_KUNDLI",
      cache: "hit",
      success: true,
    });
    return { ok: true, id: cached.id };
  }

  try {
    const provider = getAstrologyProvider();
    const result = await provider.calculateKundli(normalized);
    const stored = await persistKundliCalculation({ input: normalized, result });

    return { ok: true, id: stored.id };
  } catch (error) {
    if (isAstrologyProviderError(error)) {
      console.info("kundli_calculation_failed", {
        provider: error.provider,
        operation: error.operation ?? "JANAM_KUNDLI",
        cache: "miss",
        success: false,
        code: error.code,
      });
      return {
        ok: false,
        formErrors: [error.userMessage],
        fieldErrors: {},
      };
    }
    return {
      ok: false,
      formErrors: ["The Kundli calculation service is temporarily unavailable. Please try again."],
      fieldErrors: {},
    };
  }
}

export async function getKundliResult(id: string) {
  const calculation = await findKundliById(id);
  return calculation?.result ?? null;
}
