import { createHash } from "node:crypto";
import { astrologyCalculationConfig } from "@/config/astrology";
import type { NormalizedBirthDetails } from "@/lib/kundli/types";
import type { ValidatedBirthDetails } from "@/lib/kundli/schema";

export const CALCULATION_VERSION = astrologyCalculationConfig.version;
export const AYANAMSA = astrologyCalculationConfig.ayanamsa;
export const HOUSE_SYSTEM = astrologyCalculationConfig.houseSystem;

type CalculationReadyBirthDetails = ValidatedBirthDetails & {
  displayName: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export function normalizeBirthDetails(input: CalculationReadyBirthDetails): NormalizedBirthDetails {
  return {
    name: input.name.trim().replace(/\s+/g, " "),
    gender: input.gender ? input.gender.trim() : undefined,
    dateOfBirth: input.dateOfBirth,
    timeOfBirth: input.timeAccuracy === "UNKNOWN" ? "12:00" : input.timeOfBirth,
    timeAccuracy: input.timeAccuracy,
    location: {
      placeId: input.placeId,
      displayName: input.displayName.trim(),
      city: input.city.trim(),
      region: input.region?.trim() || undefined,
      country: input.country.trim(),
      latitude: roundCoordinate(input.latitude),
      longitude: roundCoordinate(input.longitude),
      timezone: input.timezone.trim(),
    },
  };
}

export function createKundliInputHash(
  input: NormalizedBirthDetails,
  calculationConfig: { ayanamsa: string; houseSystem: string; version: string } = astrologyCalculationConfig,
) {
  const payload = {
    dateOfBirth: input.dateOfBirth,
    timeOfBirth: input.timeOfBirth,
    timeAccuracy: input.timeAccuracy,
    latitude: input.location.latitude,
    longitude: input.location.longitude,
    timezone: input.location.timezone,
    ayanamsa: calculationConfig.ayanamsa,
    houseSystem: calculationConfig.houseSystem,
    calculationVersion: calculationConfig.version,
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(6));
}
