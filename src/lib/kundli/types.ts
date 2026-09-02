import type { NakshatraName, PlanetName, ZodiacSign } from "@/config/astrology";

export type BirthTimeAccuracy = "EXACT" | "APPROXIMATE" | "UNKNOWN";

export type LocationSuggestion = {
  placeId: string;
  displayName: string;
  city: string;
  region?: string;
  country: string;
};

export type ResolvedLocation = LocationSuggestion & {
  latitude: number;
  longitude: number;
  timezone: string;
};

export type NormalizedBirthDetails = {
  name: string;
  gender?: string;
  dateOfBirth: string;
  timeOfBirth: string;
  timeAccuracy: BirthTimeAccuracy;
  location: ResolvedLocation;
};

export type CalculationMetadata = {
  provider: string;
  providerVersion: string;
  calculationVersion: string;
  ayanamsa: string;
  houseSystem: string;
  calculatedAt: string;
  isDevelopmentFixture: boolean;
  limitations: string[];
};

export type PlanetPosition = {
  planet: PlanetName;
  longitude: number;
  latitude?: number;
  sign: ZodiacSign;
  degreeInSign: number;
  house: number;
  nakshatra: NakshatraName;
  nakshatraPada: number;
  retrograde: boolean;
};

export type KundliHouse = {
  house: number;
  sign: ZodiacSign;
  planets: PlanetName[];
};

export type KundliChartData = {
  style: "NORTH_INDIAN";
  houses: KundliHouse[];
};

export type KundliResult = {
  metadata: {
    id?: string;
    inputHash: string;
    createdAt: string;
  };
  person: {
    name: string;
    gender?: string;
    dateOfBirth: string;
    timeOfBirth: string;
    timeAccuracy: BirthTimeAccuracy;
  };
  location: ResolvedLocation;
  ascendant: {
    sign: ZodiacSign;
    degree: number;
  };
  sunSign: ZodiacSign;
  moonSign: ZodiacSign;
  nakshatra: {
    name: NakshatraName;
    pada: number;
  };
  planets: PlanetPosition[];
  houses: KundliHouse[];
  chart: KundliChartData;
  vimshottariDasha: {
    currentMahadasha: string;
    currentAntardasha: string;
    balance: string;
  };
  manglik: {
    status: "Manglik" | "Non-Manglik" | "Requires Review";
    summary: string;
  };
  yogas: Array<{
    name: string;
    summary: string;
  }>;
  calculationMetadata: CalculationMetadata;
};
