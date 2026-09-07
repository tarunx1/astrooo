import { describe, expect, it } from "vitest";
import { SIGNS } from "@/config/astrology";
import { utcInstantOf } from "@/lib/astrology/engine/local-time";
import { getSignProfile, SIGN_PROFILES } from "@/lib/astrology/horoscope";
import { SADE_SATI_RULE, classifySadeSati, signsFrom } from "@/lib/astrology/sade-sati";
import { panchangCacheKey } from "@/lib/astrology/tools-service";
import type { CalculationMetadata, ResolvedLocation } from "@/lib/kundli/types";

/**
 * Astrology tool rules that are not the ephemeris.
 *
 * The decoding tests that used to live here checked an external provider's
 * response shapes. That provider is gone, and the calculations it decoded are
 * now covered where they are made: the Panchang and the kootas in
 * native-tools.test.ts, and positions against JPL Horizons in
 * astronomy-engine.test.ts.
 */
const METADATA: CalculationMetadata = {
  provider: "ravish-engine",
  providerVersion: "vsop87d+elp2000-82b",
  calculationVersion: "ravish-kundli-v2.0",
  ayanamsa: "LAHIRI",
  houseSystem: "WHOLE_SIGN",
  calculatedAt: "2026-09-07T00:00:00.000Z",
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

describe("local day resolution", () => {
  it("uses the location's own offset, including historical and southern-hemisphere zones", () => {
    const offsetHours = (date: string, zone: string) => {
      const local = Date.UTC(
        Number(date.slice(0, 4)),
        Number(date.slice(5, 7)) - 1,
        Number(date.slice(8, 10)),
        12,
      );
      return (local - utcInstantOf(date, "12:00", zone).getTime()) / 3600000;
    };

    expect(offsetHours("2026-09-03", "Asia/Kolkata")).toBe(5.5);
    expect(offsetHours("2026-01-15", "America/New_York")).toBe(-5);
    expect(offsetHours("2026-07-15", "America/New_York")).toBe(-4);
    expect(offsetHours("2026-01-15", "Australia/Adelaide")).toBe(10.5);
  });

  it("keeps midnight inside its own local day whatever the offset", () => {
    for (const zone of ["Pacific/Kiritimati", "Pacific/Midway", "Asia/Kolkata", "UTC"]) {
      const instant = utcInstantOf("2026-09-03", "00:00", zone);
      const localDate = instant.toLocaleDateString("en-CA", { timeZone: zone });
      expect(localDate, zone).toBe("2026-09-03");
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

