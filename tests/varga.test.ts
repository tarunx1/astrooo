import { describe, expect, it } from "vitest";
import {
  SUPPORTED_DIVISIONS,
  VARGA_DEFINITIONS,
  calculateVarga,
  getVargaSign,
} from "@/lib/astrology/charts/varga";
import { getNavamsaSign } from "@/lib/astrology/charts/navamsa";
import { getSignNumber } from "@/lib/astrology/charts/signs";

/** Longitude of a given degree in a given sign. Aries is 1. */
const at = (sign: number, degree: number) => (sign - 1) * 30 + degree;

const ARIES = 1;
const TAURUS = 2;
const GEMINI = 3;
const CANCER = 4;
const LEO = 5;
const VIRGO = 6;
const LIBRA = 7;
const SCORPIO = 8;
const SAGITTARIUS = 9;
const CAPRICORN = 10;
const AQUARIUS = 11;
const PISCES = 12;

describe("varga engine", () => {
  it("supports the sixteen classical divisions", () => {
    expect(SUPPORTED_DIVISIONS).toEqual([1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60]);
  });

  it("rejects a division it does not implement", () => {
    expect(() => calculateVarga(0, 5)).toThrow(/Unsupported varga/);
  });

  describe("D1 Rashi", () => {
    it("is the identity", () => {
      for (let sign = 1; sign <= 12; sign += 1) {
        expect(getVargaSign(at(sign, 17.4), 1)).toBe(sign);
      }
    });
  });

  describe("D2 Hora", () => {
    // An odd sign gives the Sun's hora (Leo) first, an even sign the Moon's.
    it("gives Leo then Cancer in an odd sign", () => {
      expect(getVargaSign(at(ARIES, 0), 2)).toBe(LEO);
      expect(getVargaSign(at(ARIES, 14.99), 2)).toBe(LEO);
      expect(getVargaSign(at(ARIES, 15), 2)).toBe(CANCER);
      expect(getVargaSign(at(ARIES, 29.99), 2)).toBe(CANCER);
    });

    it("gives Cancer then Leo in an even sign", () => {
      expect(getVargaSign(at(TAURUS, 0), 2)).toBe(CANCER);
      expect(getVargaSign(at(TAURUS, 15), 2)).toBe(LEO);
    });

    it("only ever produces Cancer or Leo", () => {
      for (let longitude = 0; longitude < 360; longitude += 0.7) {
        expect([CANCER, LEO]).toContain(getVargaSign(longitude, 2));
      }
    });
  });

  describe("D3 Drekkana", () => {
    // The sign, the 5th from it, then the 9th from it.
    it("runs to the 5th and 9th, not to adjacent signs", () => {
      expect(getVargaSign(at(ARIES, 5), 3)).toBe(ARIES);
      expect(getVargaSign(at(ARIES, 15), 3)).toBe(LEO);
      expect(getVargaSign(at(ARIES, 25), 3)).toBe(SAGITTARIUS);
    });

    it("wraps correctly from a late sign", () => {
      expect(getVargaSign(at(SCORPIO, 25), 3)).toBe(CANCER); // 9th from Scorpio
    });
  });

  describe("D4 Chaturthamsha", () => {
    // The sign, then the 4th, 7th and 10th from it.
    it("steps by the angles", () => {
      expect(getVargaSign(at(ARIES, 1), 4)).toBe(ARIES);
      expect(getVargaSign(at(ARIES, 8), 4)).toBe(CANCER);
      expect(getVargaSign(at(ARIES, 16), 4)).toBe(LIBRA);
      expect(getVargaSign(at(ARIES, 23), 4)).toBe(CAPRICORN);
    });
  });

  describe("D7 Saptamsha", () => {
    it("starts from the sign in an odd sign", () => {
      expect(getVargaSign(at(ARIES, 0), 7)).toBe(ARIES);
    });

    it("starts from the 7th in an even sign", () => {
      expect(getVargaSign(at(TAURUS, 0), 7)).toBe(SCORPIO);
    });
  });

  describe("D9 Navamsha", () => {
    it("starts from the sign itself for a movable sign", () => {
      expect(getVargaSign(at(ARIES, 0), 9)).toBe(ARIES);
    });

    it("starts from the 9th for a fixed sign", () => {
      expect(getVargaSign(at(TAURUS, 0), 9)).toBe(CAPRICORN);
    });

    it("starts from the 5th for a dual sign", () => {
      // 5th from Gemini, counted inclusively, is Libra.
      expect(getVargaSign(at(GEMINI, 0), 9)).toBe(LIBRA);
    });

    /**
     * The generic engine must not drift from the navamsa implementation it
     * replaced. Same answer everywhere, or one of them is wrong.
     */
    it("agrees with the existing navamsa implementation across the zodiac", () => {
      for (let longitude = 0; longitude < 360; longitude += 0.13) {
        expect(getVargaSign(longitude, 9)).toBe(getNavamsaSign(longitude));
      }
    });
  });

  describe("D10 Dashamsha", () => {
    it("starts from the sign in an odd sign and the 9th in an even one", () => {
      expect(getVargaSign(at(ARIES, 0), 10)).toBe(ARIES);
      expect(getVargaSign(at(TAURUS, 0), 10)).toBe(CAPRICORN);
    });
  });

  describe("D12 Dwadashamsha", () => {
    it("counts consecutively from the sign itself", () => {
      expect(getVargaSign(at(ARIES, 0), 12)).toBe(ARIES);
      expect(getVargaSign(at(ARIES, 2.5), 12)).toBe(TAURUS);
      expect(getVargaSign(at(ARIES, 29.9), 12)).toBe(PISCES);
    });
  });

  describe("D16 Shodashamsha", () => {
    it("starts from Aries, Leo or Sagittarius by quality", () => {
      expect(getVargaSign(at(ARIES, 0), 16)).toBe(ARIES); // movable
      expect(getVargaSign(at(TAURUS, 0), 16)).toBe(LEO); // fixed
      expect(getVargaSign(at(GEMINI, 0), 16)).toBe(SAGITTARIUS); // dual
    });
  });

  describe("D20 Vimshamsha", () => {
    it("starts from Aries, Sagittarius or Leo by quality", () => {
      expect(getVargaSign(at(ARIES, 0), 20)).toBe(ARIES);
      expect(getVargaSign(at(TAURUS, 0), 20)).toBe(SAGITTARIUS);
      expect(getVargaSign(at(GEMINI, 0), 20)).toBe(LEO);
    });
  });

  describe("D24 Chaturvimshamsha", () => {
    it("starts from Leo in an odd sign and Cancer in an even one", () => {
      expect(getVargaSign(at(ARIES, 0), 24)).toBe(LEO);
      expect(getVargaSign(at(TAURUS, 0), 24)).toBe(CANCER);
    });
  });

  describe("D27 Saptavimshamsha", () => {
    it("starts from the element's own sign", () => {
      expect(getVargaSign(at(ARIES, 0), 27)).toBe(ARIES); // fire
      expect(getVargaSign(at(TAURUS, 0), 27)).toBe(CANCER); // earth
      expect(getVargaSign(at(GEMINI, 0), 27)).toBe(LIBRA); // air
      expect(getVargaSign(at(CANCER, 0), 27)).toBe(CAPRICORN); // water
      expect(getVargaSign(at(LEO, 0), 27)).toBe(ARIES); // fire again
    });
  });

  describe("D30 Trimshamsha", () => {
    // Five unequal parts of the five non-luminaries, reversed for even signs.
    it("maps the five unequal parts of an odd sign", () => {
      expect(getVargaSign(at(ARIES, 3), 30)).toBe(ARIES); // Mars 0-5
      expect(getVargaSign(at(ARIES, 7), 30)).toBe(AQUARIUS); // Saturn 5-10
      expect(getVargaSign(at(ARIES, 15), 30)).toBe(SAGITTARIUS); // Jupiter 10-18
      expect(getVargaSign(at(ARIES, 20), 30)).toBe(GEMINI); // Mercury 18-25
      expect(getVargaSign(at(ARIES, 27), 30)).toBe(LIBRA); // Venus 25-30
    });

    it("reverses the order in an even sign", () => {
      expect(getVargaSign(at(TAURUS, 3), 30)).toBe(TAURUS); // Venus 0-5
      expect(getVargaSign(at(TAURUS, 8), 30)).toBe(VIRGO); // Mercury 5-12
      expect(getVargaSign(at(TAURUS, 15), 30)).toBe(PISCES); // Jupiter 12-20
      expect(getVargaSign(at(TAURUS, 22), 30)).toBe(CAPRICORN); // Saturn 20-25
      expect(getVargaSign(at(TAURUS, 27), 30)).toBe(SCORPIO); // Mars 25-30
    });

    it("never yields a luminary's sign", () => {
      for (let longitude = 0; longitude < 360; longitude += 0.3) {
        expect([CANCER, LEO]).not.toContain(getVargaSign(longitude, 30));
      }
    });

    it("places segment boundaries in the following segment", () => {
      expect(getVargaSign(at(ARIES, 5), 30)).toBe(AQUARIUS);
      expect(getVargaSign(at(ARIES, 10), 30)).toBe(SAGITTARIUS);
      expect(getVargaSign(at(ARIES, 18), 30)).toBe(GEMINI);
      expect(getVargaSign(at(ARIES, 25), 30)).toBe(LIBRA);
    });
  });

  describe("D40 Khavedamsha", () => {
    it("starts from Aries in an odd sign and Libra in an even one", () => {
      expect(getVargaSign(at(ARIES, 0), 40)).toBe(ARIES);
      expect(getVargaSign(at(TAURUS, 0), 40)).toBe(LIBRA);
    });
  });

  describe("D45 Akshavedamsha", () => {
    it("starts from Aries, Leo or Sagittarius by quality", () => {
      expect(getVargaSign(at(ARIES, 0), 45)).toBe(ARIES);
      expect(getVargaSign(at(TAURUS, 0), 45)).toBe(LEO);
      expect(getVargaSign(at(GEMINI, 0), 45)).toBe(SAGITTARIUS);
    });
  });

  describe("D60 Shashtiamsha", () => {
    it("advances one sign each half degree from the sign itself", () => {
      expect(getVargaSign(at(ARIES, 0), 60)).toBe(ARIES);
      expect(getVargaSign(at(ARIES, 0.5), 60)).toBe(TAURUS);
      expect(getVargaSign(at(ARIES, 1.0), 60)).toBe(GEMINI);
      // 12 parts brings it back around to the sign itself.
      expect(getVargaSign(at(ARIES, 6.0), 60)).toBe(ARIES);
    });
  });

  describe("boundaries and invariants", () => {
    /**
     * A half-degree boundary in a D60 is 0.5 exactly, but 3°20' in a D9 is
     * 3.3333... in binary. A value a hair below a boundary must still land on
     * it, or the planet falls a whole sign short.
     */
    it("snaps a longitude a hair under a boundary onto it", () => {
      const justUnder = at(ARIES, 10 / 3 - 1e-12); // a shade under 3°20'
      expect(getVargaSign(justUnder, 9)).toBe(TAURUS);
    });

    it("produces a valid sign for every division across the whole zodiac", () => {
      for (const { division } of VARGA_DEFINITIONS) {
        for (let longitude = 0; longitude < 360; longitude += 0.37) {
          const sign = getVargaSign(longitude, division);
          expect(Number.isInteger(sign)).toBe(true);
          expect(sign).toBeGreaterThanOrEqual(1);
          expect(sign).toBeLessThanOrEqual(12);
        }
      }
    });

    it("keeps the scaled degree inside its sign for every division", () => {
      for (const { division } of VARGA_DEFINITIONS) {
        for (let longitude = 0; longitude < 360; longitude += 0.37) {
          const { degreeInSign } = calculateVarga(longitude, division);
          expect(degreeInSign).toBeGreaterThanOrEqual(0);
          expect(degreeInSign).toBeLessThanOrEqual(30);
        }
      }
    });

    it("scales the degree across the whole varga sign", () => {
      // Halfway through the first navamsa is halfway through the D9 sign.
      const { sign, degreeInSign } = calculateVarga(at(ARIES, 10 / 6), 9);
      expect(sign).toBe(ARIES);
      expect(degreeInSign).toBeCloseTo(15, 9);
    });

    it("normalises a longitude outside 0-360 before dividing", () => {
      expect(getVargaSign(at(ARIES, 5) + 720, 3)).toBe(getVargaSign(at(ARIES, 5), 3));
      expect(getVargaSign(at(ARIES, 5) - 360, 3)).toBe(getVargaSign(at(ARIES, 5), 3));
    });

    it("treats the start of every sign as the first part", () => {
      for (const { division, rule } of VARGA_DEFINITIONS) {
        for (let sign = 1; sign <= 12; sign += 1) {
          const { index } = calculateVarga(at(sign, 0), division);
          expect(index).toBe(0);
          expect(getSignNumber(at(sign, 0))).toBe(sign);
          expect(rule.kind === "equal" || rule.kind === "unequal").toBe(true);
        }
      }
    });
  });
});
