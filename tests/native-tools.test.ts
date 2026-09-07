import { describe, expect, it } from "vitest";
import { NAKSHATRAS, SIGNS } from "@/config/astrology";
import { computeAshtakoota } from "@/lib/astrology/engine/ashtakoota";
import { computeChart } from "@/lib/astrology/engine/chart";
import { utcInstantOf } from "@/lib/astrology/engine/local-time";
import { computePanchang } from "@/lib/astrology/engine/panchang";
import { NoSunCrossingError, sunAltitude, sunTimes } from "@/lib/astrology/engine/sun-times";

const DELHI = { latitude: 28.6139, longitude: 77.209, timezone: "Asia/Kolkata" };

describe("sunrise and sunset", () => {
  it("puts the Sun on the horizon at both times", () => {
    const dayStart = utcInstantOf("2024-06-21", "00:00", DELHI.timezone);
    const { sunrise, sunset } = sunTimes(dayStart, DELHI.latitude, DELHI.longitude);

    // The standard altitude accounts for refraction and the Sun's own size.
    for (const at of [sunrise, sunset]) {
      expect(Math.abs(sunAltitude(at, DELHI.latitude, DELHI.longitude) + 50 / 60)).toBeLessThan(0.001);
    }
    expect(sunset.getTime()).toBeGreaterThan(sunrise.getTime());
  });

  it("matches published times to the minute", () => {
    const check = (date: string, expectedRise: string, expectedSet: string) => {
      const { sunrise, sunset } = sunTimes(
        utcInstantOf(date, "00:00", DELHI.timezone),
        DELHI.latitude,
        DELHI.longitude,
      );
      const local = (at: Date) =>
        at.toLocaleTimeString("en-GB", { timeZone: DELHI.timezone, hour: "2-digit", minute: "2-digit" });
      expect(local(sunrise), `${date} sunrise`).toBe(expectedRise);
      expect(local(sunset), `${date} sunset`).toBe(expectedSet);
    };

    check("2024-06-21", "05:23", "19:22");
    check("2024-12-21", "07:09", "17:28");
  });

  it("gives the longest day at the solstice and near twelve hours at the equinox", () => {
    const lengthOn = (date: string) => {
      const { sunrise, sunset } = sunTimes(
        utcInstantOf(date, "00:00", DELHI.timezone),
        DELHI.latitude,
        DELHI.longitude,
      );
      return (sunset.getTime() - sunrise.getTime()) / 3600000;
    };

    expect(lengthOn("2024-06-21")).toBeGreaterThan(lengthOn("2024-03-20"));
    expect(lengthOn("2024-03-20")).toBeGreaterThan(lengthOn("2024-12-21"));
    // The equinox is a little over twelve hours because of refraction.
    expect(lengthOn("2024-03-20")).toBeGreaterThan(12);
    expect(lengthOn("2024-03-20")).toBeLessThan(12.3);
  });

  it("says so when the Sun does not cross the horizon", () => {
    // Longyearbyen in midsummer: the Sun never sets.
    const midsummer = utcInstantOf("2024-06-21", "00:00", "UTC");
    expect(() => sunTimes(midsummer, 78.22, 15.63)).toThrow(NoSunCrossingError);
    expect(() => sunTimes(midsummer, 78.22, 15.63)).toThrow(/does not set/i);

    // And in midwinter it never rises.
    const midwinter = utcInstantOf("2024-12-21", "00:00", "UTC");
    expect(() => sunTimes(midwinter, 78.22, 15.63)).toThrow(/does not rise/i);
  });
});

describe("Panchang", () => {
  const panchangOn = (date: string) =>
    computePanchang(utcInstantOf(date, "00:00", DELHI.timezone), DELHI.latitude, DELHI.longitude);

  it("puts the festivals on the tithis that define them", () => {
    // Festival dates are public and fixed by tithi, so these check the tithi
    // calculation against something outside this project entirely.
    expect(panchangOn("2024-03-25").tithi.name).toBe("Purnima");
    expect(panchangOn("2024-07-21").tithi.name).toBe("Purnima");
    expect(panchangOn("2025-03-14").tithi.name).toBe("Purnima");
    expect(panchangOn("2025-10-21").tithi.name).toBe("Amavasya");

    // Diwali 2024: Amavasya began that afternoon, so sunrise was Chaturdashi.
    const diwali = panchangOn("2024-10-31");
    expect(diwali.tithi.name).toBe("Chaturdashi");
    expect(diwali.tithi.paksha).toBe("Krishna");
  });

  it("names the weekday the calendar names", () => {
    expect(panchangOn("2024-03-25").vara.english).toBe("Monday");
    expect(panchangOn("2024-10-31").vara.english).toBe("Thursday");
    expect(panchangOn("2025-10-21").vara.english).toBe("Tuesday");
  });

  it("keeps every limb inside its own range across a full year", () => {
    for (let day = 1; day <= 365; day += 11) {
      const date = new Date(Date.UTC(2025, 0, day)).toISOString().slice(0, 10);
      const panchang = panchangOn(date);

      expect(panchang.tithi.number, date).toBeGreaterThanOrEqual(1);
      expect(panchang.tithi.number, date).toBeLessThanOrEqual(30);
      expect(panchang.yoga.number, date).toBeGreaterThanOrEqual(1);
      expect(panchang.yoga.number, date).toBeLessThanOrEqual(27);
      expect(panchang.karana.number, date).toBeGreaterThanOrEqual(1);
      expect(panchang.karana.number, date).toBeLessThanOrEqual(60);
      expect(NAKSHATRAS, date).toContain(panchang.nakshatra.name);
      expect(panchang.nakshatra.pada, date).toBeGreaterThanOrEqual(1);
      expect(panchang.nakshatra.pada, date).toBeLessThanOrEqual(4);
      expect(panchang.sunset.getTime(), date).toBeGreaterThan(panchang.sunrise.getTime());
    }
  });

  it("agrees between paksha and tithi number", () => {
    for (let day = 1; day <= 60; day += 3) {
      const date = new Date(Date.UTC(2025, 5, day)).toISOString().slice(0, 10);
      const { tithi } = panchangOn(date);
      expect(tithi.paksha, date).toBe(tithi.number <= 15 ? "Shukla" : "Krishna");
    }
  });

  it("names the karana by its position in the lunar month", () => {
    // The first and last three karanas of a lunar month are fixed; the seven
    // movable ones fill everything between.
    const movable = ["Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti"];
    const fixed = ["Kimstughna", "Shakuni", "Chatushpada", "Naga"];

    for (let day = 1; day <= 60; day += 2) {
      const date = new Date(Date.UTC(2025, 2, day)).toISOString().slice(0, 10);
      const { karana } = panchangOn(date);
      const isFixedSlot = karana.number === 1 || karana.number >= 58;
      expect(isFixedSlot ? fixed : movable, `${date} #${karana.number}`).toContain(karana.name);
    }
  });
});

describe("Ashtakoota", () => {
  const groom = { moonSign: SIGNS[0], moonNakshatra: NAKSHATRAS[0] };
  const bride = { moonSign: SIGNS[4], moonNakshatra: NAKSHATRAS[4] };

  it("reports all eight kootas, scoring only the ones it can", () => {
    const result = computeAshtakoota(groom, bride);
    expect(result.kootas).toHaveLength(8);
    expect(result.kootas.map((koota) => koota.key)).toEqual([
      "varna", "vashya", "tara", "yoni", "grahaMaitri", "gana", "bhakoot", "nadi",
    ]);

    const scored = result.kootas.filter((koota) => koota.score !== null);
    expect(scored.map((koota) => koota.key)).toEqual(["varna", "tara", "bhakoot", "nadi"]);
    expect(result.availableMax).toBe(1 + 3 + 7 + 8);
    expect(result.traditionalMax).toBe(36);
  });

  it("says why an uncalculated koota has no score, instead of scoring zero", () => {
    const result = computeAshtakoota(groom, bride);
    for (const koota of result.kootas.filter((entry) => entry.score === null)) {
      // A zero is a result. This is an absence, and it has to read as one.
      expect(koota.details, koota.key).toMatch(/not calculated/i);
    }
  });

  it("never exceeds what the calculated kootas can award", () => {
    for (let a = 0; a < 27; a += 1) {
      for (let b = 0; b < 27; b += 4) {
        const result = computeAshtakoota(
          { moonSign: SIGNS[a % 12], moonNakshatra: NAKSHATRAS[a] },
          { moonSign: SIGNS[b % 12], moonNakshatra: NAKSHATRAS[b] },
        );
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(result.availableMax);
      }
    }
  });

  it("scores Nadi zero for a shared nadi and full otherwise", () => {
    const nadiOf = (index: number) =>
      computeAshtakoota(
        { moonSign: SIGNS[0], moonNakshatra: NAKSHATRAS[index] },
        { moonSign: SIGNS[0], moonNakshatra: NAKSHATRAS[index] },
      ).kootas.find((koota) => koota.key === "nadi")!;

    // Identical nakshatras always share a nadi.
    for (let index = 0; index < 27; index += 1) expect(nadiOf(index).score, NAKSHATRAS[index]).toBe(0);

    // Ashwini is Adi and Bharani is Madhya, so these differ.
    const different = computeAshtakoota(
      { moonSign: SIGNS[0], moonNakshatra: "Ashwini" },
      { moonSign: SIGNS[0], moonNakshatra: "Bharani" },
    );
    expect(different.kootas.find((koota) => koota.key === "nadi")!.score).toBe(8);
  });

  it("splits the twenty-seven nakshatras evenly between the three nadis", () => {
    // Nine each. A miscopied membership list would almost certainly break this.
    const counts = new Map<number, number>();
    for (const nakshatra of NAKSHATRAS) {
      const score = computeAshtakoota(
        { moonSign: SIGNS[0], moonNakshatra: "Ashwini" },
        { moonSign: SIGNS[0], moonNakshatra: nakshatra },
      ).kootas.find((koota) => koota.key === "nadi")!.score!;
      counts.set(score, (counts.get(score) ?? 0) + 1);
    }
    // Nine share Ashwini's Adi nadi and score zero; eighteen do not.
    expect(counts.get(0)).toBe(9);
    expect(counts.get(8)).toBe(18);
  });

  it("blocks Bhakoot only on the classical sign relationships", () => {
    const bhakootFor = (offset: number) =>
      computeAshtakoota(
        { moonSign: SIGNS[0], moonNakshatra: NAKSHATRAS[0] },
        { moonSign: SIGNS[offset % 12], moonNakshatra: NAKSHATRAS[0] },
      ).kootas.find((koota) => koota.key === "bhakoot")!.score;

    // 2/12, 5/9 and 6/8 apart score nothing; everything else scores seven.
    for (const blocked of [1, 4, 5, 7, 8, 11]) expect(bhakootFor(blocked), `offset ${blocked}`).toBe(0);
    for (const allowed of [0, 2, 3, 6, 9, 10]) expect(bhakootFor(allowed), `offset ${allowed}`).toBe(7);
  });

  it("keeps Tara within its range and symmetric in structure", () => {
    for (let a = 0; a < 27; a += 1) {
      const result = computeAshtakoota(
        { moonSign: SIGNS[0], moonNakshatra: NAKSHATRAS[a] },
        { moonSign: SIGNS[0], moonNakshatra: NAKSHATRAS[(a + 7) % 27] },
      );
      const tara = result.kootas.find((koota) => koota.key === "tara")!.score!;
      expect([0, 1.5, 3]).toContain(tara);
    }
  });
});

describe("transit positions", () => {
  it("gives all nine bodies with the nodes opposite", () => {
    const chart = computeChart(new Date("2026-09-07T09:00:00Z"), {
      latitude: 0,
      longitude: 0,
      timezone: "UTC",
    });

    expect(chart.planets).toHaveLength(9);
    const rahu = chart.planets.find((planet) => planet.planet === "Rahu")!;
    const ketu = chart.planets.find((planet) => planet.planet === "Ketu")!;
    expect((ketu.longitude - rahu.longitude + 360) % 360).toBeCloseTo(180, 6);
  });

  it("gives the same longitudes wherever the observer is", () => {
    // Only the houses depend on the place: a planet's longitude does not.
    const at = new Date("2026-09-07T09:00:00Z");
    const greenwich = computeChart(at, { latitude: 0, longitude: 0, timezone: "UTC" });
    const sydney = computeChart(at, { latitude: -33.87, longitude: 151.21, timezone: "Australia/Sydney" });

    for (const planet of greenwich.planets) {
      const other = sydney.planets.find((entry) => entry.planet === planet.planet)!;
      expect(other.longitude, planet.planet).toBeCloseTo(planet.longitude, 9);
    }
  });
});
