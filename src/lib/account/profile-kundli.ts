import "server-only";

import { astrologyCalculationConfig } from "@/config/astrology";
import { getAstrologyProvider } from "@/lib/astrology/provider";
import { isAstrologyProviderError } from "@/lib/astrology/errors";
import { createKundliInputHash } from "@/lib/kundli/normalize";
import type { NormalizedBirthDetails } from "@/lib/kundli/types";
import { prisma } from "@/lib/db/prisma";
import { getOwnedBirthProfile } from "@/lib/account/birth-profiles";

/**
 * Generates (or reuses) the Kundli for a birth profile the user owns.
 *
 * The deterministic input hash is the single source of identity for a
 * calculation. If a matching calculation already exists - from this user, from
 * an anonymous visitor, or from anyone else - it is reused as-is and never
 * mutated. Only when no calculation matches is the provider called.
 */
export type ProfileKundliOutcome =
  | { ok: true; calculationId: string }
  | { ok: false; reason: "not_found" | "provider_error"; message?: string };

function toNormalized(profile: {
  name: string;
  gender: string | null;
  dateOfBirth: string;
  timeOfBirth: string;
  timeAccuracy: "EXACT" | "APPROXIMATE" | "UNKNOWN";
  placeName: string;
  placeId: string | null;
  city: string;
  region: string | null;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}): NormalizedBirthDetails {
  return {
    name: profile.name,
    gender: profile.gender ?? undefined,
    dateOfBirth: profile.dateOfBirth,
    timeOfBirth: profile.timeOfBirth,
    timeAccuracy: profile.timeAccuracy,
    location: {
      placeId: profile.placeId ?? `stored:${profile.latitude},${profile.longitude}`,
      displayName: profile.placeName,
      city: profile.city,
      region: profile.region ?? undefined,
      country: profile.country,
      latitude: profile.latitude,
      longitude: profile.longitude,
      timezone: profile.timezone,
    },
  };
}

export async function generateKundliForOwnedProfile(
  userId: string,
  profileId: string,
): Promise<ProfileKundliOutcome> {
  const profile = await getOwnedBirthProfile(userId, profileId);
  if (!profile) return { ok: false, reason: "not_found" };

  const normalized = toNormalized(profile);
  const inputHash = createKundliInputHash(normalized);

  const existing = await prisma.astrologyCalculation.findFirst({
    where: { calculationType: "JANAM_KUNDLI", inputHash },
    select: { id: true },
  });

  if (existing) {
    await linkSavedKundli(userId, profileId, existing.id);
    return { ok: true, calculationId: existing.id };
  }

  try {
    const provider = getAstrologyProvider();
    const result = await provider.calculateKundli(normalized);

    const created = await prisma.astrologyCalculation.create({
      data: {
        birthProfileId: profileId,
        calculationType: "JANAM_KUNDLI",
        provider: result.calculationMetadata.provider,
        providerVersion: result.calculationMetadata.providerVersion,
        calculationVersion: result.calculationMetadata.calculationVersion,
        ayanamsa: result.calculationMetadata.ayanamsa ?? astrologyCalculationConfig.ayanamsa,
        houseSystem: result.calculationMetadata.houseSystem ?? astrologyCalculationConfig.houseSystem,
        calculatedAt: new Date(result.calculationMetadata.calculatedAt),
        inputHash: result.metadata.inputHash,
        input: normalized as unknown as object,
        result: result as unknown as object,
        status: "READY",
      },
      select: { id: true },
    });

    await linkSavedKundli(userId, profileId, created.id);
    return { ok: true, calculationId: created.id };
  } catch (error) {
    if (isAstrologyProviderError(error)) {
      return { ok: false, reason: "provider_error", message: error.userMessage };
    }
    return {
      ok: false,
      reason: "provider_error",
      message: "The Kundli calculation service is temporarily unavailable. Please try again.",
    };
  }
}

/** Idempotently records the user's save for this calculation. */
async function linkSavedKundli(userId: string, birthProfileId: string, calculationId: string): Promise<void> {
  const existing = await prisma.savedKundli.findUnique({
    where: { userId_calculationId: { userId, calculationId } },
    select: { id: true },
  });
  if (existing) return;

  await prisma.savedKundli.create({ data: { userId, birthProfileId, calculationId } });
}
