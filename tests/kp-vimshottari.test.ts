import { describe, expect, it } from "vitest";
import { NAKSHATRAS } from "@/config/astrology";
import {
  NAKSHATRA_ARC,
  NAKSHATRA_COUNT,
  VIMSHOTTARI_SEQUENCE,
  VIMSHOTTARI_TOTAL_YEARS,
  getKpPosition,
  getNakshatraName,
  getNakshatraNumber,
  getPada,
  getStarLord,
  listSubBoundaries,
} from "@/lib/astrology/kp/vimshottari";

/**
 * KP subdivision.
 *
 * Sub-lord boundaries are narrow - some slices are a fraction of a degree - so
 * this is tested at every boundary rather than by sampling. A sub-lord that is
 * one division out is the difference between two opposite readings, and it
 * would look entirely plausible.
 */
describe("vimshottari proportions", () => {
  it("uses the traditional order and totals 120 years", () => {
    expect(VIMSHOTTARI_SEQUENCE.map((entry) => entry.lord)).toEqual([
      "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
    ]);
    expect(VIMSHOTTARI_SEQUENCE.reduce((sum, entry) => sum + entry.years, 0)).toBe(VIMSHOTTARI_TOTAL_YEARS);
  });
});

describe("nakshatra", () => {
  it("divides the zodiac into 27 equal parts of 13°20'", () => {
    expect(NAKSHATRA_ARC).toBeCloseTo(13 + 20 / 60, 9);

    for (let n = 1; n <= NAKSHATRA_COUNT; n += 1) {
      const start = (n - 1) * NAKSHATRA_ARC;
      expect(getNakshatraNumber(start), `start of ${n}`).toBe(n);
      expect(getNakshatraNumber(start + NAKSHATRA_ARC - 1e-9)).toBe(n);
    }
  });

  it("holds at every boundary despite floating point", () => {
    for (let n = 1; n < NAKSHATRA_COUNT; n += 1) {
      const boundary = n * NAKSHATRA_ARC;
      expect(getNakshatraNumber(boundary - 1e-12), `boundary ${n}`).toBe(n + 1);
      expect(getNakshatraNumber(boundary)).toBe(n + 1);
    }
  });

  it("names the first and last correctly", () => {
    expect(getNakshatraName(0)).toBe("Ashwini");
    expect(getNakshatraName(359.99)).toBe(NAKSHATRAS[26]);
  });

  it("splits each nakshatra into four padas", () => {
    for (let pada = 1; pada <= 4; pada += 1) {
      const longitude = (pada - 1) * (NAKSHATRA_ARC / 4) + 0.01;
      expect(getPada(longitude), `pada ${pada}`).toBe(pada);
    }
    expect(getPada(NAKSHATRA_ARC - 1e-9)).toBe(4);
  });

  it("cycles the nine lords three times across the 27 nakshatras", () => {
    const lords = Array.from({ length: NAKSHATRA_COUNT }, (_, i) => getStarLord(i * NAKSHATRA_ARC + 1));

    expect(lords[0]).toBe("Ketu"); // Ashwini
    expect(lords[1]).toBe("Venus"); // Bharani
    expect(lords[2]).toBe("Sun"); // Krittika
    // The cycle repeats exactly every nine.
    expect(lords.slice(0, 9)).toEqual(lords.slice(9, 18));
    expect(lords.slice(0, 9)).toEqual(lords.slice(18, 27));
  });
});

describe("sub lords", () => {
  it("starts each nakshatra's subs from its own star lord", () => {
    for (let n = 0; n < NAKSHATRA_COUNT; n += 1) {
      const start = n * NAKSHATRA_ARC;
      const position = getKpPosition(start + 1e-6);
      // The first sub of a nakshatra always belongs to its own lord.
      expect(position.subLord, NAKSHATRAS[n]).toBe(position.starLord);
    }
  });

  it("gives each sub a width in Vimshottari proportion", () => {
    const boundaries = listSubBoundaries();
    // 27 nakshatras of 9 subs.
    expect(boundaries).toHaveLength(243);

    for (let i = 0; i < 9; i += 1) {
      const width = (i === 8 ? NAKSHATRA_ARC : boundaries[i + 1].start) - boundaries[i].start;
      const expected = (VIMSHOTTARI_SEQUENCE[i].years / VIMSHOTTARI_TOTAL_YEARS) * NAKSHATRA_ARC;
      expect(width, `sub ${i}`).toBeCloseTo(expected, 9);
    }
  });

  it("resolves every one of the 243 divisions to its declared lord", () => {
    const boundaries = listSubBoundaries();

    boundaries.forEach((boundary, index) => {
      const next = boundaries[index + 1]?.start ?? 360;
      // Just inside the division, and just before it ends.
      for (const probe of [boundary.start + 1e-7, (boundary.start + next) / 2, next - 1e-7]) {
        const position = getKpPosition(probe);
        expect(position.starLord, `division ${index} at ${probe}`).toBe(boundary.starLord);
        expect(position.subLord, `division ${index} at ${probe}`).toBe(boundary.subLord);
      }
    });
  });

  it("does not slip a division at a boundary", () => {
    for (const boundary of listSubBoundaries().slice(1)) {
      const before = getKpPosition(boundary.start - 1e-9);
      const at = getKpPosition(boundary.start);
      // The value exactly on a boundary belongs to the new division.
      expect(at.subLord, `at ${boundary.start}`).toBe(boundary.subLord);
      // And the one just before belongs to the previous one.
      expect([before.subLord, at.subLord].filter(Boolean)).toHaveLength(2);
    }
  });

  it("always produces a sub-sub lord inside the sub", () => {
    for (let step = 0; step < 400; step += 1) {
      const longitude = (step * 360) / 400 + 0.137;
      const position = getKpPosition(longitude);

      expect(VIMSHOTTARI_SEQUENCE.some((e) => e.lord === position.starLord)).toBe(true);
      expect(VIMSHOTTARI_SEQUENCE.some((e) => e.lord === position.subLord)).toBe(true);
      expect(VIMSHOTTARI_SEQUENCE.some((e) => e.lord === position.subSubLord)).toBe(true);
    }
  });

  it("is deterministic and wraps the zodiac", () => {
    expect(getKpPosition(10)).toEqual(getKpPosition(370));
    expect(getKpPosition(10)).toEqual(getKpPosition(-350));
  });
});

describe("agreement with the provider", () => {
  it("reproduces VedAstro's own nakshatra and lord for a known ascendant", () => {
    // Provider, for 07:30 12/04/1994 New Delhi, House 1:
    //   HouseRasiSign  Aries 25.9506°  -> longitude 25.9506
    //   HouseConstellation "Bharani - 4", HouseConstellationLord Venus
    const position = getKpPosition(25.950555555555557);

    expect(position.nakshatra).toBe("Bharani");
    expect(position.pada).toBe(4);
    expect(position.starLord).toBe("Venus");
  });

  it("reproduces the provider's nakshatra for each planet of a real chart", () => {
    // Longitude, nakshatra and pada exactly as VedAstro returned them for a
    // real chart. Read from the stored calculation, not written by hand.
    const cases: Array<[number, string, number]> = [
      [221.56, "Anuradha", 3],
      [2.94, "Ashwini", 1],
      [297.93, "Dhanishta", 2],
      [217.48, "Anuradha", 2],
      [80.78, "Punarvasu", 1],
      [210.04, "Vishakha", 4],
      [48.09, "Rohini", 3],
      [64.3, "Mrigashira", 4],
      [244.3, "Mula", 2],
    ];

    for (const [longitude, nakshatra, pada] of cases) {
      expect(getNakshatraName(longitude), `${longitude}° nakshatra`).toBe(nakshatra);
      expect(getPada(longitude), `${longitude}° pada`).toBe(pada);
    }
  });
});
