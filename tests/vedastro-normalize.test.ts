import { describe, expect, it } from "vitest";
import { normalizeVedAstroKundli } from "@/lib/astrology/providers/vedastro-normalize";
import { normalizeBirthDetails } from "@/lib/kundli/normalize";

const input = normalizeBirthDetails({
  name: "Ravish Sharma",
  dateOfBirth: "1992-10-25",
  timeOfBirth: "14:30",
  timeAccuracy: "EXACT",
  placeId: "dev:mumbai-in",
  displayName: "Mumbai, Maharashtra, India",
  city: "Mumbai",
  country: "India",
  latitude: 19.076,
  longitude: 72.8777,
  timezone: "Asia/Kolkata",
});

const planetPayload = [
  { Sun: planet("Leo", 125.4, "House7", "Magha - 2", false) },
  { Moon: planet("Taurus", 42.1, "House4", "Rohini - 1", false) },
  { Mars: planet("Aquarius", 301.2, "House1", "Dhanishta - 3", true) },
  { Mercury: planet("Virgo", 170.2, "House8", "Hasta - 2", false) },
  { Jupiter: planet("Cancer", 92.1, "House6", "Pushya - 4", false) },
  { Venus: planet("Libra", 190.7, "House9", "Swati - 1", false) },
  { Saturn: planet("Capricorn", 275.7, "House12", "Shravana - 3", true) },
  { Rahu: planet("Scorpio", 220.8, "House10", "Anuradha - 2", true) },
  { Ketu: planet("Taurus", 40.8, "House4", "Rohini - 1", true) },
];

const housePayload = Array.from({ length: 12 }, (_, index) => ({
  [`House${index + 1}`]: {
    HouseSignName: [
      "Aquarius",
      "Pisces",
      "Aries",
      "Taurus",
      "Gemini",
      "Cancer",
      "Leo",
      "Virgo",
      "Libra",
      "Scorpio",
      "Sagittarius",
      "Capricorn",
    ][index],
    HouseRasiSign: { Name: "Aquarius", DegreesIn: { TotalDegrees: "1.5" } },
  },
}));

describe("VedAstro normalization", () => {
  it("normalizes planets, houses, dasha, and deterministic Manglik status", () => {
    const result = normalizeVedAstroKundli({
      input,
      planetPayload,
      housePayload,
      dashaPayload: {
        Jupiter: {
          Lord: "Jupiter",
          Description: "Jupiter Dasa",
          SubDasas: { Mars: { Lord: "Mars" } },
        },
      },
      providerVersion: "test",
    });

    expect(result.calculationMetadata.provider).toBe("vedastro");
    expect(result.planets).toHaveLength(9);
    expect(result.planets.find((item) => item.planet === "Moon")).toMatchObject({ sign: "Taurus", nakshatra: "Rohini", nakshatraPada: 1 });
    expect(result.vimshottariDasha).toMatchObject({ currentMahadasha: "Jupiter", currentAntardasha: "Mars" });
    expect(result.manglik.status).toBe("Manglik");
    expect(result.yogas).toEqual([]);
  });
});

function planet(sign: string, longitude: number, house: string, nakshatra: string, retrograde: boolean) {
  return {
    PlanetRasiD1Sign: { Name: sign },
    PlanetNirayanaLongitude: longitude.toString(),
    HousePlanetOccupiesBasedOnSign: house,
    PlanetConstellation: nakshatra,
    IsPlanetRetrograde: String(retrograde),
  };
}
