import type { PlanetName, ZodiacSign } from "@/config/astrology";

/**
 * Provider-independent chart model.
 *
 * Everything the renderer needs and nothing it does not. Deliberately built on
 * the existing `PlanetName` and `ZodiacSign` rather than a second set of enums,
 * so a planet means the same thing here as it does everywhere else in the
 * domain.
 *
 * Signs are carried as numbers 1-12 in this layer. Placement is modular
 * arithmetic, and doing that on names means converting at every step; the name
 * is recovered once, at the edge, for display.
 */
export type SignNumber = number;

export type ChartPlanet = {
  planet: PlanetName;
  /** Absolute sidereal longitude, normalised to 0 <= longitude < 360. */
  longitude: number;
  /** 1-12, derived from the longitude. */
  sign: SignNumber;
  /** 0 <= degree < 30, derived from the longitude. */
  degreeInSign: number;
  retrograde: boolean;
};

/**
 * A chart, ready to render.
 *
 * `chartType` is descriptive only. The renderer draws whatever it is given and
 * never branches on it: a D9 is a set of signs and houses exactly as a D1 is,
 * which is what lets one renderer serve every divisional chart.
 */
export type VedicChartData = {
  chartType: string;
  ascendantSign: SignNumber;
  /** Absent for derived charts where a longitude has no meaning. */
  ascendantLongitude?: number;
  planets: ChartPlanet[];
  calculatedAt?: string;
};

/** One house of a laid-out chart: which sign occupies it and what sits there. */
export type ChartHouse = {
  house: number;
  sign: SignNumber;
  signName: ZodiacSign;
  planets: ChartPlanet[];
};

/** Raised when input cannot describe a real chart. */
export class ChartDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChartDataError";
  }
}
