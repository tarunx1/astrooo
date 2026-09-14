import type { PlanetName } from "@/config/astrology";
import { normalizeLongitude } from "@/lib/astrology/charts/signs";
import { getNakshatraNumber } from "@/lib/astrology/kp/vimshottari";

/**
 * Yogini dasha: a thirty-six year cycle of eight.
 *
 * Quite unlike Vimshottari, and deliberately kept apart from it. The eight
 * yoginis run one to eight years in order, so a full turn is 1+2+...+8 = 36
 * years, and the cycle simply repeats. There is no 120-year span and no
 * proportional subdivision shared with the other system - forcing the two into
 * one algorithm would mean bending one of them.
 *
 * Which yogini a life starts in comes from the birth nakshatra: add three to
 * its number and take the remainder on eight. The +3 is the traditional offset
 * and is what makes Ashwini (1) begin in Mangala rather than Pingala.
 *
 * The balance at birth is a fraction of the starting yogini's own span, taken
 * from how far the Moon has travelled through its nakshatra - the same measure
 * Vimshottari uses, applied to a different cycle.
 */

/** The eight yoginis in order, with their lords and lengths in years. */
export const YOGINIS = [
  { name: "Mangala", lord: "Moon", years: 1 },
  { name: "Pingala", lord: "Sun", years: 2 },
  { name: "Dhanya", lord: "Jupiter", years: 3 },
  { name: "Bhramari", lord: "Mars", years: 4 },
  { name: "Bhadrika", lord: "Mercury", years: 5 },
  { name: "Ulka", lord: "Saturn", years: 6 },
  { name: "Siddha", lord: "Venus", years: 7 },
  { name: "Sankata", lord: "Rahu", years: 8 },
] as const;

export type Yogini = (typeof YOGINIS)[number]["name"];

/** A full turn of the cycle: 1 + 2 + ... + 8. */
export const YOGINI_CYCLE_YEARS = 36;

/** Days in a dasha year, matching the Vimshottari convention. */
const DASHA_YEAR_DAYS = 365.25;

const NAKSHATRA_ARC = 360 / 27;

export type YoginiPeriod = {
  yogini: Yogini;
  lord: PlanetName;
  years: number;
  start: Date;
  end: Date;
};

export type YoginiTimeline = {
  /** The yogini running at birth. */
  birthYogini: Yogini;
  /** Years of it still to run at the moment of birth. */
  balanceYears: number;
  periods: YoginiPeriod[];
};

/** Which yogini a nakshatra begins, 0-7. */
export function yoginiIndexFor(nakshatra: number): number {
  // The traditional offset. Ashwini begins Mangala, not Pingala.
  return (nakshatra + 2) % 8;
}

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

/**
 * The Yogini timeline from birth.
 *
 * Laid out from where the birth period actually began, before the birth, so the
 * first yogini is not reported shorter than it is. `cycles` sets how many turns
 * of the thirty-six years are produced.
 */
export function buildYoginiTimeline(
  birth: Date,
  moonLongitude: number,
  cycles = 3,
): YoginiTimeline {
  const longitude = normalizeLongitude(moonLongitude);
  const nakshatra = getNakshatraNumber(longitude);
  const index = yoginiIndexFor(nakshatra);

  const elapsedInNakshatra = (longitude - (nakshatra - 1) * NAKSHATRA_ARC) / NAKSHATRA_ARC;
  const first = YOGINIS[index];
  const balanceYears = (1 - elapsedInNakshatra) * first.years;

  const periodStart = addDays(birth, -elapsedInNakshatra * first.years * DASHA_YEAR_DAYS);

  const periods: YoginiPeriod[] = [];
  let cursor = periodStart;

  for (let step = 0; step < YOGINIS.length * cycles; step += 1) {
    const yogini = YOGINIS[(index + step) % YOGINIS.length];
    const end = addDays(cursor, yogini.years * DASHA_YEAR_DAYS);

    periods.push({
      yogini: yogini.name,
      lord: yogini.lord as PlanetName,
      years: yogini.years,
      start: cursor,
      end,
    });
    cursor = end;
  }

  return { birthYogini: first.name, balanceYears, periods };
}

/** The period containing an instant, if the timeline covers it. */
export function yoginiAt(timeline: YoginiTimeline, at: Date): YoginiPeriod | null {
  return timeline.periods.find((period) => at >= period.start && at < period.end) ?? null;
}
