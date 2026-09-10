import type { PlanetName } from "@/config/astrology";
import { normalizeDegrees } from "@/lib/astrology/engine/angles";
import { NAKSHATRA_ARC, VIMSHOTTARI_SEQUENCE, VIMSHOTTARI_TOTAL_YEARS } from "@/lib/astrology/kp/vimshottari";

/**
 * Vimshottari dasha: the timeline a Vedic chart is read against.
 *
 * The 120-year cycle is divided between the nine lords in fixed proportions,
 * and where a life starts in that cycle is set by the Moon's nakshatra at
 * birth - specifically by how much of that nakshatra the Moon had already
 * crossed. So the whole timeline pivots on one longitude, which is why it is
 * worth being exact about the Moon.
 *
 * Every level below the first is the same division applied again, in the same
 * order, starting from the lord of the period being divided.
 */

/** Days in a dasha year. The tradition counts a solar year of 365.25 days. */
export const DASHA_YEAR_DAYS = 365.25;

export type DashaPeriod = {
  lord: PlanetName;
  start: Date;
  end: Date;
  /** Nested sub-periods, present down to the depth that was asked for. */
  periods?: DashaPeriod[];
};

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

/**
 * Splits a span between the nine lords in Vimshottari proportion, beginning
 * with `startLord`. The last slice is closed onto the span's own end so that
 * rounding cannot leave a gap between one period and the next.
 */
function subdivide(start: Date, end: Date, startLord: PlanetName, depth: number): DashaPeriod[] {
  const totalMs = end.getTime() - start.getTime();
  const first = VIMSHOTTARI_SEQUENCE.findIndex((entry) => entry.lord === startLord);
  if (first < 0) throw new Error(`${startLord} is not a Vimshottari dasha lord.`);

  const periods: DashaPeriod[] = [];
  let cursor = start;

  for (let step = 0; step < VIMSHOTTARI_SEQUENCE.length; step += 1) {
    const entry = VIMSHOTTARI_SEQUENCE[(first + step) % VIMSHOTTARI_SEQUENCE.length];
    const isLast = step === VIMSHOTTARI_SEQUENCE.length - 1;
    const periodEnd = isLast
      ? end
      : new Date(cursor.getTime() + (totalMs * entry.years) / VIMSHOTTARI_TOTAL_YEARS);

    periods.push({
      lord: entry.lord,
      start: cursor,
      end: periodEnd,
      // Each level is the same division again, starting from its own lord.
      periods: depth > 1 ? subdivide(cursor, periodEnd, entry.lord, depth - 1) : undefined,
    });
    cursor = periodEnd;
  }

  return periods;
}

/** Which lord governs the nakshatra a longitude falls in, and how far through it the point is. */
function nakshatraLordAndProgress(moonLongitude: number): { lord: PlanetName; elapsed: number } {
  const longitude = normalizeDegrees(moonLongitude);
  const index = Math.floor(longitude / NAKSHATRA_ARC) % 27;
  return {
    // The nine lords repeat three times across the twenty-seven nakshatras.
    lord: VIMSHOTTARI_SEQUENCE[index % VIMSHOTTARI_SEQUENCE.length].lord,
    elapsed: (longitude - index * NAKSHATRA_ARC) / NAKSHATRA_ARC,
  };
}

export type DashaTimeline = {
  /** The lord ruling at birth, and how much of that period was already spent. */
  birthLord: PlanetName;
  /** Years of the birth mahadasha still to run at the moment of birth. */
  balanceYears: number;
  /** Mahadashas covering one full 120-year cycle from the start of the birth period. */
  periods: DashaPeriod[];
};

/**
 * Builds the dasha timeline for a birth.
 *
 * The first period is entered part-way through, so the cycle is laid out from
 * where that period actually began - before the birth - and the balance is
 * reported separately. Starting the timeline at the birth instant instead
 * would make the first mahadasha look short by however much of it had already
 * elapsed.
 */
export function buildDashaTimeline(birth: Date, moonLongitude: number, depth = 2): DashaTimeline {
  const { lord, elapsed } = nakshatraLordAndProgress(moonLongitude);
  const years = VIMSHOTTARI_SEQUENCE.find((entry) => entry.lord === lord)!.years;

  const periodStart = addDays(birth, -elapsed * years * DASHA_YEAR_DAYS);
  const cycleEnd = addDays(periodStart, VIMSHOTTARI_TOTAL_YEARS * DASHA_YEAR_DAYS);

  return {
    birthLord: lord,
    balanceYears: (1 - elapsed) * years,
    periods: subdivide(periodStart, cycleEnd, lord, depth),
  };
}

/** How deep the tradition names the divisions, outermost first. */
export const DASHA_LEVELS = ["Mahadasha", "Antardasha", "Pratyantardasha", "Sookshma"] as const;

/**
 * The next level down inside one period, computed on demand.
 *
 * Four levels deep is over seven thousand periods, and a reader opens a
 * handful of them. Subdividing a single period when it is opened costs
 * nothing and keeps the whole tree from being built - or sent to a browser -
 * so that a few rows can be read.
 */
export function subdivideDasha(period: DashaPeriod): DashaPeriod[] {
  return subdivide(period.start, period.end, period.lord, 1);
}

/** The innermost period containing an instant, from the outermost inwards. */
export function dashaChainAt(timeline: DashaTimeline, at: Date): DashaPeriod[] {
  const chain: DashaPeriod[] = [];
  let level: DashaPeriod[] | undefined = timeline.periods;

  while (level) {
    const period: DashaPeriod | undefined = level.find(
      (candidate) => at >= candidate.start && at < candidate.end,
    );
    if (!period) break;
    chain.push(period);
    level = period.periods;
  }

  return chain;
}

/** Formats a balance as the years, months and days a Panchang would print. */
export function formatBalance(balanceYears: number): string {
  const totalDays = balanceYears * DASHA_YEAR_DAYS;
  const years = Math.floor(totalDays / DASHA_YEAR_DAYS);
  const afterYears = totalDays - years * DASHA_YEAR_DAYS;
  const months = Math.floor(afterYears / (DASHA_YEAR_DAYS / 12));
  const days = Math.round(afterYears - months * (DASHA_YEAR_DAYS / 12));
  return `${years}y ${months}m ${days}d`;
}
