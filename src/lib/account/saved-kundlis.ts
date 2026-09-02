import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { NormalizedBirthDetails } from "@/lib/kundli/types";

/**
 * Saved Kundli access layer.
 *
 * AstrologyCalculation rows are globally deduplicated by input hash, so one row
 * can be reached by any number of people who typed identical birth details.
 * Saving therefore never re-points or re-owns the calculation's original
 * BirthProfile. Instead the saving user gets their own BirthProfile copy plus a
 * SavedKundli row, leaving every other user's data untouched.
 */
export type SavedKundliSummary = {
  id: string;
  calculationId: string;
  profileName: string;
  placeName: string;
  calculatedAt: Date | null;
  savedAt: Date;
  lagna: string | null;
  moonSign: string | null;
  nakshatra: string | null;
};

type SavedKundliRow = {
  id: string;
  calculationId: string;
  profileName: string;
  placeName: string;
  calculatedAt: Date | null;
  savedAt: Date;
  lagna: string | null;
  moonSign: string | null;
  nakshatra: string | null;
};

/**
 * Lists a user's saved Kundlis.
 *
 * Summary values are projected out of the result JSON in Postgres so the large
 * chart payload never crosses the wire for a listing page.
 */
export async function listSavedKundlis(userId: string): Promise<SavedKundliSummary[]> {
  const rows = await prisma.$queryRaw<SavedKundliRow[]>(Prisma.sql`
    SELECT
      sk."id"                                   AS "id",
      sk."calculationId"                        AS "calculationId",
      bp."name"                                 AS "profileName",
      bp."placeName"                            AS "placeName",
      ac."calculatedAt"                         AS "calculatedAt",
      sk."createdAt"                            AS "savedAt",
      ac."result" -> 'ascendant' ->> 'sign'     AS "lagna",
      ac."result" ->> 'moonSign'                AS "moonSign",
      ac."result" -> 'nakshatra' ->> 'name'     AS "nakshatra"
    FROM "SavedKundli" sk
    JOIN "BirthProfile" bp ON bp."id" = sk."birthProfileId"
    JOIN "AstrologyCalculation" ac ON ac."id" = sk."calculationId"
    WHERE sk."userId" = ${userId}
    ORDER BY sk."createdAt" DESC
  `);

  return rows;
}

export async function isKundliSavedByUser(userId: string, calculationId: string): Promise<boolean> {
  const existing = await prisma.savedKundli.findUnique({
    where: { userId_calculationId: { userId, calculationId } },
    select: { id: true },
  });
  return existing !== null;
}

export type SaveKundliOutcome =
  | { ok: true; alreadySaved: boolean; profileId: string }
  | { ok: false; reason: "not_found" };

/**
 * Attaches a calculation to a user's account.
 *
 * The caller must already have proven continuation context; this function does
 * not by itself authorise a claim. It copies the birth details recorded on the
 * calculation into a profile owned by `userId`.
 */
export async function saveKundliToAccount(userId: string, calculationId: string): Promise<SaveKundliOutcome> {
  const calculation = await prisma.astrologyCalculation.findUnique({
    where: { id: calculationId },
    select: { id: true, input: true },
  });

  if (!calculation) return { ok: false, reason: "not_found" };

  const existing = await prisma.savedKundli.findUnique({
    where: { userId_calculationId: { userId, calculationId } },
    select: { id: true, birthProfileId: true },
  });

  if (existing) {
    return { ok: true, alreadySaved: true, profileId: existing.birthProfileId };
  }

  const input = calculation.input as unknown as NormalizedBirthDetails;

  return prisma.$transaction(async (tx) => {
    const profile = await tx.birthProfile.create({
      data: {
        userId,
        name: input.name,
        gender: input.gender ?? null,
        placeId: input.location.placeId,
        dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
        timeOfBirth: input.timeOfBirth,
        timeAccuracy: input.timeAccuracy,
        placeName: input.location.displayName,
        placeOfBirth: input.location.displayName,
        city: input.location.city,
        region: input.location.region ?? null,
        country: input.location.country,
        latitude: input.location.latitude,
        longitude: input.location.longitude,
        timezone: input.location.timezone,
      },
      select: { id: true },
    });

    await tx.savedKundli.create({
      data: { userId, birthProfileId: profile.id, calculationId },
    });

    return { ok: true as const, alreadySaved: false, profileId: profile.id };
  });
}

/** Removes a save. Scoped by userId so one user cannot unsave another's Kundli. */
export async function removeSavedKundli(userId: string, savedKundliId: string): Promise<boolean> {
  const result = await prisma.savedKundli.deleteMany({ where: { id: savedKundliId, userId } });
  return result.count === 1;
}
