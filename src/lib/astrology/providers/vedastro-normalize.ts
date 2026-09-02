import { NAKSHATRAS, PLANETS, SIGNS, astrologyCalculationConfig, type NakshatraName, type PlanetName, type ZodiacSign } from "@/config/astrology";
import type { KundliHouse, KundliResult, NormalizedBirthDetails, PlanetPosition } from "@/lib/kundli/types";
import { createKundliInputHash } from "@/lib/kundli/normalize";

type PlanetRecord = Record<string, unknown>;

export function normalizeVedAstroKundli({
  input,
  planetPayload,
  housePayload,
  dashaPayload,
  providerVersion,
}: {
  input: NormalizedBirthDetails;
  planetPayload: unknown;
  housePayload: unknown;
  dashaPayload: unknown;
  providerVersion: string;
}): KundliResult {
  const planetRecords = extractNamedRecords(planetPayload, PLANETS);
  const houseRecords: Record<string, PlanetRecord> = extractHouseRecords(housePayload);
  const planets = PLANETS.map((planet) => normalizePlanet(planet, planetRecords[planet], houseRecords)).filter(Boolean) as PlanetPosition[];

  if (planets.length !== PLANETS.length) {
    throw new Error(`VedAstro planet payload is incomplete. Expected ${PLANETS.length}, received ${planets.length}.`);
  }

  const houses = normalizeHouses(houseRecords, planets);
  const ascendant = houses[0] ?? { house: 1, sign: planets[0].sign, planets: [] };
  const moon = planets.find((planet) => planet.planet === "Moon") ?? planets[0];
  const sun = planets.find((planet) => planet.planet === "Sun") ?? planets[0];
  const dasha = normalizeDasha(dashaPayload);
  const calculatedAt = new Date().toISOString();

  return {
    metadata: {
      inputHash: createKundliInputHash(input),
      createdAt: calculatedAt,
    },
    person: {
      name: input.name,
      gender: input.gender,
      dateOfBirth: input.dateOfBirth,
      timeOfBirth: input.timeOfBirth,
      timeAccuracy: input.timeAccuracy,
    },
    location: input.location,
    ascendant: {
      sign: ascendant.sign,
      degree: roundDegree(extractSignDegree(houseRecords.House1, "HouseRasiSign") ?? 0),
    },
    sunSign: sun.sign,
    moonSign: moon.sign,
    nakshatra: {
      name: moon.nakshatra,
      pada: moon.nakshatraPada,
    },
    planets,
    houses,
    chart: {
      style: "NORTH_INDIAN",
      houses,
    },
    vimshottariDasha: dasha,
    manglik: normalizeManglik(planets),
    yogas: [],
    calculationMetadata: {
      provider: "vedastro",
      providerVersion,
      calculationVersion: astrologyCalculationConfig.version,
      ayanamsa: astrologyCalculationConfig.ayanamsa,
      houseSystem: astrologyCalculationConfig.houseSystem,
      calculatedAt,
      isDevelopmentFixture: false,
      limitations: ["Yoga detection is returned as an empty list until deterministic production rules are added."],
    },
  };
}

export function normalizePlanet(planet: PlanetName, record: unknown, houseRecords: Record<string, PlanetRecord>): PlanetPosition | null {
  if (!record || typeof record !== "object") return null;
  const source = record as PlanetRecord;
  const longitude = firstNumber(source, ["PlanetNirayanaLongitude", "NirayanaLongitude", "PlanetLongitude", "Longitude", "TotalDegrees"]) ?? 0;
  const sign = normalizeSign(firstString(source, ["PlanetRasiD1Sign", "PlanetSignName", "SignName", "Sign", "ZodiacSign"]) ?? signFromLongitude(longitude));
  const nakshatraParts = parseNakshatra(firstString(source, ["PlanetConstellation", "Constellation", "Nakshatra"]) ?? nakshatraFromLongitude(longitude));
  const house = normalizeHouse(firstString(source, ["HousePlanetOccupiesBasedOnSign", "HousePlanetOccupiesBasedOnLongitudes", "PlanetHouseName", "HouseName"])) ?? houseFromSign(sign, houseRecords);

  return {
    planet,
    longitude: roundDegree(longitude),
    latitude: firstNumber(source, ["PlanetCelestialLatitude", "Latitude"]),
    sign,
    degreeInSign: roundDegree(extractSignDegree(source, "PlanetRasiD1Sign") ?? firstNumber(source, ["DegreesInSign"]) ?? ((longitude % 30) + 30) % 30),
    house,
    nakshatra: nakshatraParts.name,
    nakshatraPada: nakshatraParts.pada,
    retrograde: firstBoolean(source, ["IsPlanetRetrograde", "PlanetRetrograde", "Retrograde"]) ?? false,
  };
}

export function normalizeDasha(payload: unknown): KundliResult["vimshottariDasha"] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const first = Object.values(root).find((value) => value && typeof value === "object") as Record<string, unknown> | undefined;
  const subDasas = first?.SubDasas && typeof first.SubDasas === "object" ? (first.SubDasas as Record<string, unknown>) : {};
  const firstSub = Object.values(subDasas).find((value) => value && typeof value === "object") as Record<string, unknown> | undefined;

  return {
    currentMahadasha: String(first?.Lord ?? "Unavailable"),
    currentAntardasha: String(firstSub?.Lord ?? "Unavailable"),
    balance: first?.Description ? String(first.Description) : "Provider did not return a balance value.",
  };
}

export function extractNamedRecords<TName extends string>(payload: unknown, names: readonly TName[]): Partial<Record<TName, PlanetRecord>> {
  const result: Partial<Record<TName, PlanetRecord>> = {};
  const rows = Array.isArray(payload) ? payload : [payload];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    for (const name of names) {
      const value = (row as Record<string, unknown>)[name];
      if (value && typeof value === "object") result[name] = value as PlanetRecord;
    }
  }

  return result;
}

export function extractHouseRecords(payload: unknown) {
  const records = extractNamedRecords(payload, Array.from({ length: 12 }, (_, index) => `House${index + 1}`));
  return Object.fromEntries(Object.entries(records).filter((entry): entry is [string, PlanetRecord] => Boolean(entry[1])));
}

function normalizeHouses(houseRecords: Record<string, PlanetRecord>, planets: PlanetPosition[]): KundliHouse[] {
  return Array.from({ length: 12 }, (_, index) => {
    const houseNumber = index + 1;
    const key = `House${houseNumber}`;
    const sign = normalizeSign(firstString(houseRecords[key], ["HouseSignName", "HouseRasiSign", "SignName", "Sign"]) ?? SIGNS[index]);
    return {
      house: houseNumber,
      sign,
      planets: planets.filter((planet) => planet.house === houseNumber).map((planet) => planet.planet),
    };
  });
}

function normalizeManglik(planets: PlanetPosition[]): KundliResult["manglik"] {
  const marsHouse = planets.find((planet) => planet.planet === "Mars")?.house;
  const isManglik = [1, 4, 7, 8, 12].includes(marsHouse ?? 0);
  return {
    status: isManglik ? "Manglik" : "Non-Manglik",
    summary: "Determined by Mars placement in houses 1, 4, 7, 8 or 12 because VedAstro does not expose a single Manglik status in this adapter.",
  };
}

function firstString(record: unknown, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = extractPathValue(record, key);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object" && "Name" in value && typeof value.Name === "string") return value.Name;
  }
}

function firstNumber(record: unknown, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = extractPathValue(record, key);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
    if (value && typeof value === "object") {
      const nested = firstNumber(value, ["TotalDegrees", "Degrees"]);
      if (nested !== undefined) return nested;
    }
  }
}

function firstBoolean(record: unknown, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = extractPathValue(record, key);
    if (typeof value === "boolean") return value;
    if (typeof value === "string" && ["true", "false"].includes(value.toLowerCase())) return value.toLowerCase() === "true";
  }
}

function extractPathValue(record: unknown, key: string): unknown {
  if (!record || typeof record !== "object") return undefined;
  const value = (record as Record<string, unknown>)[key];
  if (value !== undefined) return value;
  for (const nested of Object.values(record as Record<string, unknown>)) {
    if (nested && typeof nested === "object") {
      const nestedValue = (nested as Record<string, unknown>)[key];
      if (nestedValue !== undefined) return nestedValue;
    }
  }
}

function normalizeSign(value: string): ZodiacSign {
  const sign = SIGNS.find((candidate) => candidate.toLowerCase() === value.replace(/^Sign/i, "").trim().toLowerCase());
  if (!sign) throw new Error(`Unsupported zodiac sign from VedAstro: ${value}`);
  return sign;
}

function parseNakshatra(value: string): { name: NakshatraName; pada: number } {
  const [rawName, rawPada] = value.split("-").map((part) => part.trim());
  const canonicalRawName = nakshatraAliases[rawName.toLowerCase()] ?? rawName;
  const name = NAKSHATRAS.find((candidate) => candidate.toLowerCase() === canonicalRawName.toLowerCase()) ?? NAKSHATRAS[0];
  const pada = Number(rawPada);
  return { name, pada: Number.isInteger(pada) && pada >= 1 && pada <= 4 ? pada : 1 };
}

function normalizeHouse(value?: string) {
  const match = value?.match(/House\s*(\d{1,2})/i);
  const house = match ? Number(match[1]) : undefined;
  return house && house >= 1 && house <= 12 ? house : undefined;
}

function houseFromSign(sign: ZodiacSign, houseRecords: Record<string, PlanetRecord>) {
  for (let index = 1; index <= 12; index += 1) {
    const houseSign = firstString(houseRecords[`House${index}`], ["HouseSignName", "HouseRasiSign", "SignName", "Sign"]);
    if (houseSign && normalizeSign(houseSign) === sign) return index;
  }
  return 1;
}

function signFromLongitude(longitude: number) {
  return SIGNS[Math.floor((((longitude % 360) + 360) % 360) / 30)];
}

function nakshatraFromLongitude(longitude: number) {
  const normalized = ((longitude % 360) + 360) % 360;
  const nakshatraIndex = Math.floor(normalized / (360 / 27));
  const pada = (Math.floor((normalized % (360 / 27)) / (360 / 108)) % 4) + 1;
  return `${NAKSHATRAS[nakshatraIndex]} - ${pada}`;
}

function extractSignDegree(record: unknown, key: string) {
  const value = extractPathValue(record, key);
  if (value && typeof value === "object") return firstNumber(value, ["DegreesIn", "TotalDegrees"]);
}

function roundDegree(value: number) {
  return Number(value.toFixed(2));
}

const nakshatraAliases: Record<string, NakshatraName> = {
  swathi: "Swati",
  chitta: "Chitra",
  vishhaka: "Vishakha",
  vishakha: "Vishakha",
  uttara: "Uttara Phalguni",
  sravana: "Shravana",
  moola: "Mula",
  mrigasira: "Mrigashira",
};
