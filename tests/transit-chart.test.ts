import { describe, expect, it } from "vitest";
import { createTransitChart } from "@/lib/astrology/charts/factory";
import { currentTransitAnchor, getCurrentTransits } from "@/lib/astrology/tools-service";

/**
 * Gochar for a chosen moment.
 *
 * The Kundli result page lets a reader pick a transit date. Two properties make
 * that safe to offer: the same instant always yields the same chart, and asking
 * for a transit never touches the natal calculation - the transit chart is
 * built from positions plus a reference sign, and nothing it does can reach the
 * stored birth data.
 */
const REFERENCE_LAGNA = 3; // Gemini
const REFERENCE_MOON = 1; // Aries

describe("transit anchoring", () => {
  it("anchors to the top of the hour", () => {
    const anchored = currentTransitAnchor(new Date("2030-06-15T12:47:31.412Z"));

    expect(anchored.toISOString()).toBe("2030-06-15T12:00:00.000Z");
  });

  it("gives the same anchor for any moment within one hour", () => {
    const a = currentTransitAnchor(new Date("2030-06-15T12:00:00.000Z"));
    const b = currentTransitAnchor(new Date("2030-06-15T12:59:59.999Z"));

    // The cache key is the anchor, so two readers a minute apart share a result.
    expect(a.toISOString()).toBe(b.toISOString());
  });
});

describe("transit positions", () => {
  it("is deterministic for one instant", async () => {
    const at = new Date("2030-06-15T12:00:00.000Z");

    const [first, second] = await Promise.all([getCurrentTransits(at), getCurrentTransits(at)]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.value.positions).toEqual(second.value.positions);
  });

  it("moves the planets between distant dates", async () => {
    const [then, later] = await Promise.all([
      getCurrentTransits(new Date("1995-03-01T12:00:00.000Z")),
      getCurrentTransits(new Date("2030-06-15T12:00:00.000Z")),
    ]);

    expect(then.ok && later.ok).toBe(true);
    if (!then.ok || !later.ok) return;

    // Thirty-five years apart: nothing should be where it was.
    expect(then.value.positions).not.toEqual(later.value.positions);
  });

  it("puts the Sun in sidereal Leo in mid-September", async () => {
    // An independent check that these are real positions, not placeholders.
    // Sidereal Leo runs roughly 17 August to 17 September.
    const outcome = await getCurrentTransits(new Date("2026-09-12T12:00:00.000Z"));

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const sun = outcome.value.positions.find((position) => position.planet === "Sun");
    expect(sun).toBeDefined();

    // Leo spans 120-150 degrees of sidereal longitude.
    expect(sun!.longitude).toBeGreaterThanOrEqual(120);
    expect(sun!.longitude).toBeLessThan(150);
  });
});

describe("the reference sign", () => {
  it("counts houses from whichever sign it is given", async () => {
    const outcome = await getCurrentTransits(new Date("2026-09-12T12:00:00.000Z"));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const fromLagna = createTransitChart({
      natalAscendantSign: REFERENCE_LAGNA,
      transits: outcome.value.positions,
    });

    const fromMoon = createTransitChart({
      natalAscendantSign: REFERENCE_MOON,
      transits: outcome.value.positions,
    });

    expect(fromLagna.ascendantSign).toBe(REFERENCE_LAGNA);
    expect(fromMoon.ascendantSign).toBe(REFERENCE_MOON);

    // Same planets, same signs - only the house frame differs.
    expect(fromLagna.planets.map((planet) => planet.sign)).toEqual(
      fromMoon.planets.map((planet) => planet.sign),
    );
  });

  it("marks the chart as a transit chart", async () => {
    const outcome = await getCurrentTransits(new Date("2026-09-12T12:00:00.000Z"));
    if (!outcome.ok) return;

    const chart = createTransitChart({
      natalAscendantSign: REFERENCE_LAGNA,
      transits: outcome.value.positions,
    });

    // The renderer and any consumer can tell this is not a birth chart.
    expect(chart.chartType).toBe("GOCHAR");
  });
});
