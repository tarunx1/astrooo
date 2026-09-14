import "server-only";

import { getPanchang } from "@/lib/astrology/tools-service";
import type { PanchangResult } from "@/lib/astrology/tool-types";
import { getLocationProvider } from "@/lib/location/provider";
import type { ResolvedLocation } from "@/lib/kundli/types";

/**
 * Today's Panchang for the homepage card.
 *
 * The card used to be five frozen strings in `data/home.ts` - it announced
 * "Shukla Paksha Dashami" under a "Today" heading on every day of the year.
 * These values are now calculated, and only the ones the engine actually
 * returns are shown: a missing limb is left out rather than estimated, which is
 * the same rule the full /panchang page follows.
 */

/** The city the homepage speaks for until a visitor names their own. */
const DEFAULT_PLACE = "New Delhi";

export type HomePanchang = {
  location: ResolvedLocation;
  date: string;
  sunrise?: string;
  sunset?: string;
  phase?: string;
  rows: ReadonlyArray<readonly [string, string]>;
};

/**
 * The default city, resolved once per process.
 *
 * `search` is a provider call and the homepage is server-rendered on every
 * visit, so resolving on each render would spend a geocoding request per page
 * view to answer a question whose answer never changes. The promise itself is
 * memoised so concurrent first renders share one lookup rather than racing.
 */
let defaultLocation: Promise<ResolvedLocation | null> | null = null;

function resolveDefaultLocation(): Promise<ResolvedLocation | null> {
  defaultLocation ??= (async () => {
    try {
      // The provider is the only thing that turns a place into coordinates and
      // a timezone, so the city is looked up rather than written down here.
      const provider = getLocationProvider();
      const [suggestion] = await provider.search(DEFAULT_PLACE);
      if (!suggestion) return null;
      return await provider.resolve(suggestion.placeId);
    } catch {
      // A geocoding failure must not take the homepage down with it.
      defaultLocation = null;
      return null;
    }
  })();

  return defaultLocation;
}

/**
 * The calendar date at that place, which is not necessarily the server's.
 *
 * A server in UTC rolls over five and a half hours before Delhi does, so
 * `new Date()` on its own would show tomorrow's Panchang for part of every
 * evening. `en-CA` is used because it formats as YYYY-MM-DD.
 */
function todayAt(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * The five limbs, in their traditional order, skipping anything absent.
 *
 * Rahu Kaal and Abhijit Muhurat were on the old hardcoded card but are not in
 * `PanchangResult` at all - the engine does not calculate them, so they are not
 * shown. Sunrise fills a gap only if a limb is missing, keeping the card five
 * rows tall without inventing one.
 */
function limbsOf(value: PanchangResult): Array<readonly [string, string]> {
  const rows: Array<readonly [string, string]> = [];

  if (value.tithi) {
    rows.push(["Tithi", [value.tithi.paksha, value.tithi.name].filter(Boolean).join(" ")]);
  }
  if (value.vara) rows.push(["Vara", value.vara]);
  if (value.nakshatra) rows.push(["Nakshatra", value.nakshatra.name]);
  if (value.yoga) rows.push(["Yoga", value.yoga.name]);
  if (value.karana) rows.push(["Karana", value.karana]);
  if (rows.length < 5 && value.sunrise) rows.push(["Sunrise", value.sunrise]);

  return rows.slice(0, 5);
}

/** Today's Panchang, or null if it cannot be calculated right now. */
export async function getHomePanchang(): Promise<HomePanchang | null> {
  const location = await resolveDefaultLocation();
  if (!location) return null;

  const date = todayAt(location.timezone);
  const outcome = await getPanchang({ date, location });
  if (!outcome.ok) return null;

  const rows = limbsOf(outcome.value);
  if (rows.length === 0) return null;

  return { location, date, rows, sunrise: outcome.value.sunrise, sunset: outcome.value.sunset, phase: outcome.value.tithi?.phase };
}
