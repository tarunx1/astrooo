import "server-only";

import { getLocationProvider } from "@/lib/location/provider";
import { normalizeBirthDetails } from "@/lib/kundli/normalize";
import { birthDetailsSchema, resolvedLocationSchema } from "@/lib/kundli/schema";
import type { BirthDetailsInput } from "@/lib/kundli/schema";
import type { NormalizedBirthDetails } from "@/lib/kundli/types";
import { prisma } from "@/lib/db/prisma";

/**
 * Birth profile access layer.
 *
 * Every function here takes the acting `userId` as its first argument and that
 * value must always come from the server session. A userId supplied by the
 * browser is never accepted. Reads and writes are filtered by `userId` inside
 * the query itself, so an unowned id simply matches no row - the pattern that
 * closes IDOR rather than relying on a post-fetch comparison.
 */
export type BirthProfileSummary = {
  id: string;
  name: string;
  dateOfBirth: string;
  timeOfBirth: string;
  timeAccuracy: "EXACT" | "APPROXIMATE" | "UNKNOWN";
  placeName: string;
  createdAt: Date;
};

export type BirthProfileDetail = BirthProfileSummary & {
  gender: string | null;
  placeId: string | null;
  city: string;
  region: string | null;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type BirthDetailsResolution =
  | { ok: true; normalized: NormalizedBirthDetails }
  | { ok: false; formErrors: string[]; fieldErrors: Record<string, string[]> };

/**
 * Validates and normalizes raw birth input using the *same* canonical schema,
 * location provider and normalizer as Kundli generation. Validation rules are
 * imported, never restated.
 */
export async function resolveBirthDetails(input: BirthDetailsInput): Promise<BirthDetailsResolution> {
  const parsed = birthDetailsSchema.safeParse(input);
  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return { ok: false, formErrors: flattened.formErrors, fieldErrors: flattened.fieldErrors };
  }

  const resolvedLocation = await getLocationProvider().resolve(parsed.data.placeId);
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

  return {
    ok: true,
    normalized: normalizeBirthDetails({
      ...parsed.data,
      displayName: resolvedLocation.displayName,
      city: resolvedLocation.city,
      region: resolvedLocation.region ?? "",
      country: resolvedLocation.country,
      latitude: resolvedLocation.latitude,
      longitude: resolvedLocation.longitude,
      timezone: resolvedLocation.timezone,
    }),
  };
}

const SUMMARY_SELECT = {
  id: true,
  name: true,
  dateOfBirth: true,
  timeOfBirth: true,
  timeAccuracy: true,
  placeName: true,
  createdAt: true,
} as const;

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Lists only the fields the profile list actually renders. */
export async function listBirthProfiles(userId: string): Promise<BirthProfileSummary[]> {
  const rows = await prisma.birthProfile.findMany({
    where: { userId },
    select: SUMMARY_SELECT,
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    dateOfBirth: toIsoDate(row.dateOfBirth),
    timeOfBirth: row.timeOfBirth,
    timeAccuracy: row.timeAccuracy,
    placeName: row.placeName,
    createdAt: row.createdAt,
  }));
}

/** Returns the profile only when it belongs to `userId`; otherwise null. */
export async function getOwnedBirthProfile(userId: string, profileId: string): Promise<BirthProfileDetail | null> {
  const row = await prisma.birthProfile.findFirst({
    where: { id: profileId, userId },
    select: {
      ...SUMMARY_SELECT,
      gender: true,
      placeId: true,
      city: true,
      region: true,
      country: true,
      latitude: true,
      longitude: true,
      timezone: true,
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    dateOfBirth: toIsoDate(row.dateOfBirth),
    timeOfBirth: row.timeOfBirth,
    timeAccuracy: row.timeAccuracy,
    placeName: row.placeName,
    createdAt: row.createdAt,
    gender: row.gender,
    placeId: row.placeId,
    city: row.city,
    region: row.region,
    country: row.country,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    timezone: row.timezone,
  };
}

function toProfileData(normalized: NormalizedBirthDetails) {
  return {
    name: normalized.name,
    gender: normalized.gender ?? null,
    placeId: normalized.location.placeId,
    dateOfBirth: new Date(`${normalized.dateOfBirth}T00:00:00.000Z`),
    timeOfBirth: normalized.timeOfBirth,
    timeAccuracy: normalized.timeAccuracy,
    placeName: normalized.location.displayName,
    placeOfBirth: normalized.location.displayName,
    city: normalized.location.city,
    region: normalized.location.region ?? null,
    country: normalized.location.country,
    latitude: normalized.location.latitude,
    longitude: normalized.location.longitude,
    timezone: normalized.location.timezone,
  };
}

export async function createBirthProfile(userId: string, normalized: NormalizedBirthDetails): Promise<string> {
  const created = await prisma.birthProfile.create({
    data: { userId, ...toProfileData(normalized) },
    select: { id: true },
  });
  return created.id;
}

/**
 * Updates a profile in place, scoped by ownership.
 *
 * Calculation-relevant values may change here. No AstrologyCalculation is ever
 * mutated: the deterministic input hash of the edited details simply resolves to
 * a different calculation, which is fetched or generated on next view. Old
 * calculations stay immutable and continue to describe the data they were run
 * against.
 */
export async function updateOwnedBirthProfile(
  userId: string,
  profileId: string,
  normalized: NormalizedBirthDetails,
): Promise<boolean> {
  const result = await prisma.birthProfile.updateMany({
    where: { id: profileId, userId },
    data: toProfileData(normalized),
  });
  return result.count === 1;
}

/**
 * Deletes a profile the user owns.
 *
 * Policy: SavedKundli rows cascade (they are per-user bookmarks), while
 * AstrologyCalculation rows are retained with birthProfileId set to null. Those
 * rows are the auditable record of a real calculation and future paid reports
 * will reference them, so they must outlive a profile deletion.
 */
export async function deleteOwnedBirthProfile(userId: string, profileId: string): Promise<boolean> {
  const result = await prisma.birthProfile.deleteMany({ where: { id: profileId, userId } });
  return result.count === 1;
}
