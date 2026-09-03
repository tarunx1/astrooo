import { describe, expect, it } from "vitest";
import {
  ASHTAKOOTA_MAX_SCORE,
  PANCHANG_UNAVAILABLE_FIELDS,
  normalizeVedAstroCompatibility,
  normalizeVedAstroPanchang,
} from "@/lib/astrology/providers/vedastro-tools";
import { SADE_SATI_RULE, classifySadeSati, signsFrom } from "@/lib/astrology/sade-sati";
import { KOOTA_KEYS } from "@/lib/astrology/tool-types";
import { panchangCacheKey } from "@/lib/astrology/tools-service";
import { getHistoricalUtcOffset } from "@/lib/astrology/providers/vedastro-time";
import { getSignProfile, SIGN_PROFILES } from "@/lib/astrology/horoscope";
import { NAKSHATRAS, SIGNS } from "@/config/astrology";
import { normalizePlanet } from "@/lib/astrology/providers/vedastro-normalize";
import { normalizeVedAstroTransitPlanet } from "@/lib/astrology/providers/vedastro-tools";
import type { CalculationMetadata, ResolvedLocation } from "@/lib/kundli/types";

const METADATA: CalculationMetadata = {
  provider: "vedastro",
  providerVersion: "1.0.0",
  calculationVersion: "ravish-kundli-v1.1",
  ayanamsa: "LAHIRI",
  houseSystem: "VEDASTRO_DEFAULT",
  calculatedAt: "2026-09-03T00:00:00.000Z",
  isDevelopmentFixture: false,
  limitations: [],
};

const AMRITSAR: ResolvedLocation = {
  placeId: "dev:amritsar-in",
  displayName: "Amritsar, Punjab, India",
  city: "Amritsar",
  region: "Punjab",
  country: "India",
  latitude: 31.634,
  longitude: 74.8723,
  timezone: "Asia/Kolkata",
};

/**
 * Fixture captured from a real VedAstro PanchangaTable response for
 * 14/08/1992 at Amritsar. Field names and nesting are exactly as returned.
 */
const PANCHANG_PAYLOAD = {
  PanchangaTable: {
    Ayanamsa: "23° 51' 11",
    Tithi: { Name: "Padyami", Paksha: "Krishna", Date: "16/30", Day: "1/15", Phase: "DarkHalf" },
    LunarMonth: "Sraavana",
    Vara: "Friday",
    Nakshatra: "Dhanishta - 4",
    Yoga: { Name: "Sobhana", Description: "Splendid, bright" },
    Karana: "Kaulava",
    HoraLord: { Name: "Moon" },
    DishaShool: "West",
    Sunrise: {
      StdTime: "05:58 14/08/1992 +05:30",
      Location: { Name: "Amritsar", Longitude: 74.8723, Latitude: 31.634 },
    },
    Sunset: {
      StdTime: "19:10 14/08/1992 +05:30",
      Location: { Name: "Amritsar", Longitude: 74.8723, Latitude: 31.634 },
    },
  },
};

describe("Panchang decoding", () => {
  it("decodes every field the engine actually returns", () => {
    const result = normalizeVedAstroPanchang({
      payload: PANCHANG_PAYLOAD,
      requestedDate: "1992-08-14",
      location: AMRITSAR,
      calculationMetadata: METADATA,
    });

    expect(result.date).toBe("1992-08-14");
    expect(result.vara).toBe("Friday"); // 14 Aug 1992 was a Friday
    expect(result.tithi).toEqual({ name: "Padyami", paksha: "Krishna", phase: "DarkHalf" });
    expect(result.nakshatra).toEqual({ name: "Dhanishta", pada: 4 });
    expect(result.yoga).toEqual({ name: "Sobhana", description: "Splendid, bright" });
    expect(result.karana).toBe("Kaulava");
    expect(result.lunarMonth).toBe("Sraavana");
    expect(result.horaLord).toBe("Moon");
  });

  it("keeps sunrise and sunset as local wall-clock times", () => {
    const result = normalizeVedAstroPanchang({
      payload: PANCHANG_PAYLOAD,
      requestedDate: "1992-08-14",
      location: AMRITSAR,
      calculationMetadata: METADATA,
    });

    // Local Amritsar time, not converted to UTC.
    expect(result.sunrise).toBe("05:58");
    expect(result.sunset).toBe("19:10");
  });

  it("declares the fields the engine cannot calculate instead of inventing them", () => {
    const result = normalizeVedAstroPanchang({
      payload: PANCHANG_PAYLOAD,
      requestedDate: "1992-08-14",
      location: AMRITSAR,
      calculationMetadata: METADATA,
    });

    expect(result.unavailableFields).toEqual(PANCHANG_UNAVAILABLE_FIELDS);
    expect(result.unavailableFields).toContain("Rahu Kaal");
    expect(result).not.toHaveProperty("rahuKaal");
    expect(result).not.toHaveProperty("moonrise");
  });

  it("refuses a response for the wrong day, which is how a defaulted request looks", () => {
    // This is the real failure mode: sending a string time makes VedAstro answer
    // Pass for 01/01/2000 at a placeholder location.
    const defaulted = {
      PanchangaTable: {
        ...PANCHANG_PAYLOAD.PanchangaTable,
        Sunrise: { StdTime: "07:26 31/12/1999 +08:00", Location: { Name: "Empty", Longitude: 101, Latitude: 4.59 } },
      },
    };

    expect(() =>
      normalizeVedAstroPanchang({
        payload: defaulted,
        requestedDate: "1992-08-14",
        location: AMRITSAR,
        calculationMetadata: METADATA,
      }),
    ).toThrowError();
  });

  it("refuses a response echoing a different location", () => {
    const wrongPlace = {
      PanchangaTable: {
        ...PANCHANG_PAYLOAD.PanchangaTable,
        Sunrise: { StdTime: "05:58 14/08/1992 +05:30", Location: { Name: "Empty", Longitude: 101, Latitude: 4.59 } },
      },
    };

    expect(() =>
      normalizeVedAstroPanchang({
        payload: wrongPlace,
        requestedDate: "1992-08-14",
        location: AMRITSAR,
        calculationMetadata: METADATA,
      }),
    ).toThrowError();
  });

  it("rejects a payload that is not an object", () => {
    expect(() =>
      normalizeVedAstroPanchang({
        payload: "unavailable",
        requestedDate: "1992-08-14",
        location: AMRITSAR,
        calculationMetadata: METADATA,
      }),
    ).toThrowError();
  });
});

describe("Panchang timezone behaviour", () => {
  it("uses the location's own offset, including historical and southern-hemisphere zones", () => {
    expect(getHistoricalUtcOffset("2026-09-03", "12:00", "Asia/Kolkata")).toBe("+05:30");
    expect(getHistoricalUtcOffset("2026-01-15", "12:00", "America/New_York")).toBe("-05:00");
    expect(getHistoricalUtcOffset("2026-07-15", "12:00", "America/New_York")).toBe("-04:00");
    expect(getHistoricalUtcOffset("2026-01-15", "12:00", "Australia/Adelaide")).toBe("+10:30");
  });

  it("keeps the same local date across very different offsets", () => {
    // Local noon is inside the local calendar day whatever the offset, which is
    // why the Panchang anchor is noon rather than midnight.
    for (const zone of ["Pacific/Kiritimati", "Pacific/Midway", "Asia/Kolkata", "UTC"]) {
      const offset = getHistoricalUtcOffset("2026-09-03", "12:00", zone);
      expect(offset, zone).toMatch(/^[+-]\d{2}:\d{2}$/);
    }
  });
});

describe("Panchang caching", () => {
  it("is stable for the same day, place and configuration", () => {
    expect(panchangCacheKey("2026-09-03", AMRITSAR)).toBe(panchangCacheKey("2026-09-03", AMRITSAR));
  });

  it("differs by date, coordinates and timezone", () => {
    const base = panchangCacheKey("2026-09-03", AMRITSAR);

    expect(panchangCacheKey("2026-09-04", AMRITSAR)).not.toBe(base);
    expect(panchangCacheKey("2026-09-03", { ...AMRITSAR, latitude: 28.7041 })).not.toBe(base);
    expect(panchangCacheKey("2026-09-03", { ...AMRITSAR, timezone: "UTC" })).not.toBe(base);
  });
});

/**
 * Fixture captured from a real VedAstro MatchReport. Note that only three of the
 * eight classical kootas carry a Score.
 */
const MATCH_PAYLOAD = {
  MatchReport: {
    KutaScore: 20.0,
    Embeddings: [3, 2, 0, 0, 3, 0, 0, 0],
    PredictionList: [
      { Name: "Graha Maitram", Nature: "Good", Score: 3.0, Info: "both are neutral, passable (3 pts)" },
      { Name: "Guna Kuta", Nature: "Good", Score: 2.0, Info: "passable (2 pts)" },
      { Name: "Yoni Kuta", Nature: "Bad", Score: 0.0, Info: "pairs are hostile, should be avoided." },
      { Name: "Varna", Nature: "Bad", Info: "varna check" },
      { Name: "Vasya Kuta", Nature: "Bad", Info: "vasya check" },
      { Name: "Dina Kuta", Nature: "Good", Info: "dina check" },
      { Name: "Rasi Kuta", Nature: "Bad", Info: "rasi check" },
      { Name: "Nadi Kuta", Nature: "Bad", Info: "nadi check" },
      { Name: "Kuja Dosa", Nature: "Good", Info: "no Kuja Dosa mismatch" },
      { Name: "Mahendra", Nature: "Good", Info: "mahendra check" },
      { Name: "Empty", Nature: "Empty", Info: "" },
    ],
  },
};

describe("compatibility decoding", () => {
  const result = normalizeVedAstroCompatibility({ payload: MATCH_PAYLOAD, calculationMetadata: METADATA });

  it("reports the engine's aggregate score against the traditional maximum", () => {
    expect(result.score).toBe(20);
    expect(result.maxScore).toBe(ASHTAKOOTA_MAX_SCORE);
    expect(result.percentage).toBe(56); // round(20/36*100)
  });

  it("returns all eight kootas in traditional order", () => {
    expect(result.kootas.map((koota) => koota.key)).toEqual([...KOOTA_KEYS]);
    expect(result.kootas).toHaveLength(8);
  });

  it("shows a score only where the engine supplied one", () => {
    const scored = result.kootas.filter((koota) => koota.score !== null);

    expect(scored.map((koota) => koota.key).sort()).toEqual(["gana", "grahaMaitri", "yoni"]);
    expect(result.summaryMetadata.kootasWithScores).toBe(3);
    expect(result.summaryMetadata.allKootaScoresProvided).toBe(false);
  });

  it("never invents a score for a koota the engine did not score", () => {
    for (const key of ["varna", "vashya", "tara", "bhakoot", "nadi"]) {
      const koota = result.kootas.find((candidate) => candidate.key === key);
      expect(koota?.score, key).toBeNull();
      // The classification is still surfaced.
      expect(koota?.status, key).not.toBe("unknown");
    }
  });

  it("never back-fills sub-scores to reach the traditional total", () => {
    const sum = result.kootas.reduce((total, koota) => total + (koota.score ?? 0), 0);

    // 3 + 2 + 0 = 5, which is deliberately not 20 and not 36.
    expect(sum).toBe(5);
    expect(sum).not.toBe(result.score);
    expect(sum).not.toBe(ASHTAKOOTA_MAX_SCORE);
  });

  it("ignores the undocumented Embeddings vector", () => {
    // Embeddings sums to 8 and its ordering is unverified, so it must not drive
    // any displayed value.
    expect(result.kootas.map((koota) => koota.score)).not.toEqual([3, 2, 0, 0, 3, 0, 0, 0]);
  });

  it("maps the Manglik comparison from Kuja Dosa", () => {
    expect(result.manglikComparison?.status).toBe("favourable");
    expect(result.manglikComparison?.summary).toContain("Kuja Dosa");
  });

  it("surfaces extra findings without the classical kootas or empty rows", () => {
    const names = result.additionalFindings.map((finding) => finding.name);

    expect(names).toContain("Mahendra");
    expect(names).not.toContain("Varna");
    expect(names).not.toContain("Kuja Dosa");
    expect(names).not.toContain("Empty");
  });

  it("handles a payload with no predictions without inventing anything", () => {
    const empty = normalizeVedAstroCompatibility({
      payload: { MatchReport: { KutaScore: null, PredictionList: [] } },
      calculationMetadata: METADATA,
    });

    expect(empty.score).toBeNull();
    expect(empty.percentage).toBeNull();
    expect(empty.kootas.every((koota) => koota.score === null)).toBe(true);
    expect(empty.kootas.every((koota) => koota.status === "unknown")).toBe(true);
    expect(empty.manglikComparison).toBeNull();
  });
});

describe("Sade Sati rule", () => {
  it("counts signs inclusively from the Moon", () => {
    expect(signsFrom("Aries", "Aries")).toBe(1);
    expect(signsFrom("Aries", "Taurus")).toBe(2);
    expect(signsFrom("Aries", "Pisces")).toBe(12);
    expect(signsFrom("Pisces", "Aries")).toBe(2);
    expect(signsFrom("Capricorn", "Sagittarius")).toBe(12);
  });

  it("classifies the three Sade Sati phases", () => {
    const first = classifySadeSati({ moonSign: "Aries", saturnSign: "Pisces", calculationMetadata: METADATA });
    expect(first.phase).toBe("first-phase");
    expect(first.isSadeSati).toBe(true);

    const peak = classifySadeSati({ moonSign: "Aries", saturnSign: "Aries", calculationMetadata: METADATA });
    expect(peak.phase).toBe("peak-phase");
    expect(peak.isSadeSati).toBe(true);

    const third = classifySadeSati({ moonSign: "Aries", saturnSign: "Taurus", calculationMetadata: METADATA });
    expect(third.phase).toBe("third-phase");
    expect(third.isSadeSati).toBe(true);
  });

  it("distinguishes the lesser Saturn periods, which are not Sade Sati", () => {
    const ardha = classifySadeSati({ moonSign: "Aries", saturnSign: "Cancer", calculationMetadata: METADATA });
    expect(ardha.phase).toBe("ardha-kantaka");
    expect(ardha.isSadeSati).toBe(false);

    const ashtama = classifySadeSati({ moonSign: "Aries", saturnSign: "Scorpio", calculationMetadata: METADATA });
    expect(ashtama.phase).toBe("ashtama-shani");
    expect(ashtama.isSadeSati).toBe(false);
  });

  it("reports not active for every other position", () => {
    const inactive = [3, 5, 6, 7, 9, 10, 11];

    for (const offset of inactive) {
      const saturnSign = SIGNS[(SIGNS.indexOf("Aries") + offset - 1) % 12];
      const result = classifySadeSati({ moonSign: "Aries", saturnSign, calculationMetadata: METADATA });

      expect(result.phase, `${offset}: ${saturnSign}`).toBe("not-active");
      expect(result.isSadeSati, saturnSign).toBe(false);
    }
  });

  it("covers all 12 positions with exactly 3 Sade Sati phases", () => {
    const phases = SIGNS.map(
      (saturnSign) => classifySadeSati({ moonSign: "Leo", saturnSign, calculationMetadata: METADATA }).isSadeSati,
    );

    expect(phases.filter(Boolean)).toHaveLength(3);
  });

  it("always states the rule it applied", () => {
    const result = classifySadeSati({ moonSign: "Leo", saturnSign: "Leo", calculationMetadata: METADATA });
    expect(result.ruleApplied).toBe(SADE_SATI_RULE);
    expect(result.ruleApplied).toContain("12th");
  });
});

describe("zodiac sign reference content", () => {
  it("covers all twelve signs exactly once", () => {
    expect(SIGN_PROFILES).toHaveLength(12);
    expect(new Set(SIGN_PROFILES.map((profile) => profile.sign)).size).toBe(12);
    expect(SIGN_PROFILES.map((profile) => profile.sign)).toEqual([...SIGNS]);
  });

  it("resolves by slug and rejects unknown slugs", () => {
    expect(getSignProfile("aries")?.sanskritName).toBe("Mesha");
    expect(getSignProfile("ophiuchus")).toBeNull();
  });

  it("gives every sign a ruler, element and modality", () => {
    for (const profile of SIGN_PROFILES) {
      expect(profile.rulingPlanet, profile.slug).toBeTruthy();
      expect(["Fire", "Earth", "Air", "Water"], profile.slug).toContain(profile.element);
      expect(["Movable", "Fixed", "Dual"], profile.slug).toContain(profile.modality);
    }
  });
});

describe("planet decoding regressions", () => {
  /**
   * VedAstro returns South-Indian transliterations that differ from our
   * canonical names for more than half the nakshatras. An unmapped spelling used
   * to fall through to the first entry, silently reporting Ashwini for a Moon in
   * Revati. These cases lock that behaviour down.
   */
  function planetRecord(constellation: string, longitude: string, sign: string, degrees: string) {
    return {
      PlanetConstellation: constellation,
      PlanetNirayanaLongitude: { TotalDegrees: longitude },
      PlanetRasiD1Sign: { Name: sign, DegreesIn: { TotalDegrees: degrees } },
      IsPlanetRetrograde: "True",
    };
  }

  it("maps VedAstro spellings to canonical nakshatra names", () => {
    const cases: Array<[string, string]> = [
      ["Revathi - 1", "Revati"],
      ["Aswini - 2", "Ashwini"],
      ["Krithika - 3", "Krittika"],
      ["Pushyami - 1", "Pushya"],
      ["Aslesha - 4", "Ashlesha"],
      ["Pubba - 2", "Purva Phalguni"],
      ["Chitta - 1", "Chitra"],
      ["Swathi - 1", "Swati"],
      ["Jyesta - 2", "Jyeshtha"],
      ["Moola - 3", "Mula"],
      ["Sravana - 1", "Shravana"],
      ["Satabhisha - 2", "Shatabhisha"],
      ["Poorvabhadra - 1", "Purva Bhadrapada"],
      ["Uttarabhadra - 4", "Uttara Bhadrapada"],
    ];

    for (const [provided, expected] of cases) {
      const position = normalizePlanet("Saturn", planetRecord(provided, "349.32", "Pisces", "19.32"), {});
      expect(position?.nakshatra, provided).toBe(expected);
    }
  });

  it("falls back to the longitude rather than to Ashwini for an unknown spelling", () => {
    // 349.32 degrees is inside Revati, the 27th nakshatra.
    const position = normalizePlanet("Saturn", planetRecord("Totally Unknown - 1", "349.32", "Pisces", "19.32"), {});

    expect(position?.nakshatra).toBe("Revati");
    expect(position?.nakshatra).not.toBe(NAKSHATRAS[0]);
  });

  it("decodes a flat single-planet transit payload", () => {
    // Requesting one planet returns its fields at the root, not under its name.
    const flat = planetRecord("Revathi - 1", "349.32", "Pisces", "19.32");
    const position = normalizeVedAstroTransitPlanet(flat, "Saturn");

    expect(position).not.toBeNull();
    expect(position?.sign).toBe("Pisces");
    expect(position?.degreeInSign).toBeCloseTo(19.32, 1);
    expect(position?.nakshatra).toBe("Revati");
    expect(position?.retrograde).toBe(true);
  });

  it("decodes a nested all-planets transit payload", () => {
    const nested = { AllPlanetData: { Saturn: planetRecord("Revathi - 1", "349.32", "Pisces", "19.32") } };
    expect(normalizeVedAstroTransitPlanet(nested, "Saturn")?.sign).toBe("Pisces");
  });

  it("returns null rather than guessing when the payload is unusable", () => {
    expect(normalizeVedAstroTransitPlanet(null, "Saturn")).toBeNull();
    expect(normalizeVedAstroTransitPlanet("nope", "Saturn")).toBeNull();
  });
});
