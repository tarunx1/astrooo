import { describe, expect, it } from "vitest";
import { calculateKaalSarp } from "@/lib/astrology/charts/kaal-sarp";
import { TARAS, calculateNavatara, taraFor } from "@/lib/astrology/charts/navatara";
import { createRashiChart } from "@/lib/astrology/charts/factory";
import { ChartDataError } from "@/lib/astrology/charts/types";

/** Builds a chart with Rahu at 0 Aries, Ketu opposite, and planets where asked. */
const chartWith = (longitudes: number[], rahu = 0) =>
  createRashiChart({
    ascendant: { sign: "Aries", degree: 5 },
    planets: [
      { planet: "Rahu", longitude: rahu, retrograde: true },
      { planet: "Ketu", longitude: (rahu + 180) % 360, retrograde: true },
      ...(["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const).map(
        (planet, index) => ({ planet, longitude: longitudes[index], retrograde: false }),
      ),
    ],
  });

describe("Kaal Sarp", () => {
  it("is present when every planet sits in the Rahu-to-Ketu half", () => {
    // Rahu at 0 Aries, so the arc runs 0 to 180. All seven inside it.
    const result = calculateKaalSarp(chartWith([20, 40, 60, 80, 100, 120, 140]));
    expect(result.present).toBe(true);
    expect(result.outside).toEqual([]);
  });

  it("is absent when even one planet is outside the arc", () => {
    const result = calculateKaalSarp(chartWith([20, 40, 60, 80, 100, 120, 200]));
    expect(result.present).toBe(false);
    expect(result.outside).toEqual(["Saturn"]);
  });

  it("reports the mirror case separately rather than as Kaal Sarp", () => {
    // Everything in the Ketu-to-Rahu half instead.
    const result = calculateKaalSarp(chartWith([200, 220, 240, 260, 280, 300, 320]));
    expect(result.present).toBe(false);
    expect(result.mirrored).toBe(true);
    expect(result.name).toBeNull();
  });

  it("names the form from the house Rahu occupies", () => {
    // Aries rising with Rahu in Aries: the 1st house, Ananta.
    const first = calculateKaalSarp(chartWith([20, 40, 60, 80, 100, 120, 140], 0));
    expect(first.rahuHouse).toBe(1);
    expect(first.name).toBe("Ananta");

    // Rahu in Taurus: the 2nd house, Kulika.
    const second = calculateKaalSarp(chartWith([50, 70, 90, 110, 130, 150, 170], 30));
    expect(second.rahuHouse).toBe(2);
    expect(second.name).toBe("Kulika");
  });

  it("names nothing when the yoga is not present", () => {
    expect(calculateKaalSarp(chartWith([20, 40, 60, 80, 100, 120, 200])).name).toBeNull();
  });

  it("treats a planet exactly on a node as inside the arc", () => {
    const onKetu = calculateKaalSarp(chartWith([20, 40, 60, 80, 100, 120, 180]));
    expect(onKetu.present).toBe(true);
  });

  it("works when the arc wraps past 0 degrees", () => {
    // Rahu at 300, so the arc runs 300 -> 360 -> 120.
    const result = calculateKaalSarp(chartWith([310, 330, 350, 10, 30, 50, 70], 300));
    expect(result.present).toBe(true);
  });

  it("refuses to answer without the nodes", () => {
    const noNodes = createRashiChart({
      ascendant: { sign: "Aries", degree: 5 },
      planets: [{ planet: "Sun", longitude: 10, retrograde: false }],
    });
    expect(() => calculateKaalSarp(noNodes)).toThrow(ChartDataError);
  });
});

describe("Navatara", () => {
  it("counts the birth nakshatra itself as Janma", () => {
    expect(taraFor(1, 1).tara).toBe("Janma");
    expect(taraFor(1, 1).taraNumber).toBe(1);
  });

  it("runs the nine taras in order", () => {
    for (let step = 0; step < 9; step += 1) {
      expect(taraFor(1, 1 + step).tara).toBe(TARAS[step]);
    }
  });

  it("repeats the cycle every ninth nakshatra", () => {
    expect(taraFor(1, 10).tara).toBe("Janma");
    expect(taraFor(1, 19).tara).toBe("Janma");
    expect(taraFor(1, 10).cycle).toBe(2);
    expect(taraFor(1, 19).cycle).toBe(3);
  });

  it("wraps around the twenty-seven", () => {
    // From Revati (27), the next is Ashwini (1) and it is Sampat.
    expect(taraFor(27, 1).tara).toBe("Sampat");
    expect(taraFor(27, 27).tara).toBe("Janma");
  });

  it("lists all twenty-seven from the birth star", () => {
    const { entries, birthNakshatra } = calculateNavatara(0); // Ashwini
    expect(birthNakshatra).toBe("Ashwini");
    expect(entries).toHaveLength(27);
    expect(entries[0].tara).toBe("Janma");
    expect(entries[0].nakshatra).toBe("Ashwini");
    expect(entries[26].taraNumber).toBe(9);
  });

  it("gives each tara exactly three nakshatras", () => {
    const { entries } = calculateNavatara(123.4);

    for (const tara of TARAS) {
      expect(entries.filter((entry) => entry.tara === tara)).toHaveLength(3);
    }
  });

  it("covers every nakshatra exactly once", () => {
    const { entries } = calculateNavatara(200);
    expect(new Set(entries.map((entry) => entry.number)).size).toBe(27);
  });
});
