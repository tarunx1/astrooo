import { describe, expect, it } from "vitest";
import { BAALADI_AVASTHAS, avasthaOf } from "@/lib/astrology/charts/avastha";

const at = (sign: number, degree: number) => (sign - 1) * 30 + degree;

describe("baaladi avastha", () => {
  it("runs forward through an odd sign", () => {
    const aries = [3, 9, 15, 21, 27].map((degree) => avasthaOf("Sun", at(1, degree)));
    expect(aries).toEqual([...BAALADI_AVASTHAS]);
  });

  it("runs backwards through an even sign", () => {
    const taurus = [3, 9, 15, 21, 27].map((degree) => avasthaOf("Sun", at(2, degree)));
    expect(taurus).toEqual([...BAALADI_AVASTHAS].reverse());
  });

  it("puts the start of an even sign at the end of the cycle", () => {
    expect(avasthaOf("Sun", at(2, 0))).toBe("Mrita");
    expect(avasthaOf("Sun", at(2, 29))).toBe("Baala");
  });

  it("cuts the sign into five equal parts", () => {
    expect(avasthaOf("Sun", at(1, 5.99))).toBe("Baala");
    expect(avasthaOf("Sun", at(1, 6))).toBe("Kumara");
    expect(avasthaOf("Sun", at(1, 24))).toBe("Mrita");
  });

  it("gives the nodes none", () => {
    expect(avasthaOf("Rahu", at(1, 10))).toBeNull();
    expect(avasthaOf("Ketu", at(7, 10))).toBeNull();
  });

  it("always returns one of the five for a real planet", () => {
    for (let longitude = 0; longitude < 360; longitude += 0.31) {
      expect(BAALADI_AVASTHAS).toContain(avasthaOf("Mars", longitude)!);
    }
  });

  it("is symmetric between an odd sign and the even one after it", () => {
    // The same degree in Aries and Taurus must give opposite ends of the scale.
    for (let degree = 0; degree < 30; degree += 1.5) {
      const odd = BAALADI_AVASTHAS.indexOf(avasthaOf("Sun", at(1, degree))!);
      const even = BAALADI_AVASTHAS.indexOf(avasthaOf("Sun", at(2, degree))!);
      expect(odd + even).toBe(4);
    }
  });
});
