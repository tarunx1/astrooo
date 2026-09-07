import { normalizeDegrees } from "@/lib/astrology/engine/angles";
import { lahiriAyanamsa, toSidereal } from "@/lib/astrology/engine/ayanamsa";
import { apparentPosition } from "@/lib/astrology/engine/geocentric";
import { moonPosition } from "@/lib/astrology/engine/moon";
import { sunTimes } from "@/lib/astrology/engine/sun-times";
import { terrestrialTime } from "@/lib/astrology/engine/time";
import { getNakshatraName, getPada } from "@/lib/astrology/kp/vimshottari";

/**
 * The Panchang: the five limbs of the Hindu calendar.
 *
 * Four of the five are arithmetic on two longitudes. The tithi is the angle
 * the Moon has gained on the Sun, in steps of twelve degrees; the yoga is
 * their sum in steps of a nakshatra; the karana is half a tithi; the nakshatra
 * is where the Moon is. Only the vara - the weekday - depends on the place,
 * because the Hindu day begins at sunrise rather than at midnight.
 */

const TITHI_NAMES = [
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami",
  "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi",
] as const;

const YOGA_NAMES = [
  "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarma",
  "Dhriti", "Shula", "Ganda", "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra",
  "Siddhi", "Vyatipata", "Variyana", "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha",
  "Shukla", "Brahma", "Indra", "Vaidhriti",
] as const;

/** The seven karanas that repeat, and the four that occur once each per lunar month. */
const MOVABLE_KARANAS = ["Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti"] as const;
const FIXED_KARANAS = { first: "Kimstughna", last: ["Shakuni", "Chatushpada", "Naga"] } as const;

const VARA_NAMES = ["Ravivara", "Somavara", "Mangalavara", "Budhavara", "Guruvara", "Shukravara", "Shanivara"] as const;
const VARA_ENGLISH = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** Chaldean order, which is the order the planetary hours run in. */
const HORA_ORDER = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"] as const;

/** The day's ruling planet, in weekday order from Sunday. */
const WEEKDAY_LORDS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const;

/** Direction traditionally avoided for travel, by weekday from Sunday. */
const DISHA_SHOOL = ["West", "East", "North", "North", "South", "West", "East"] as const;

export type PanchangElements = {
  tithi: { number: number; name: string; paksha: "Shukla" | "Krishna" };
  nakshatra: { name: string; pada: number };
  yoga: { number: number; name: string };
  karana: { number: number; name: string };
  vara: { name: string; english: string; lord: string };
  sunrise: Date;
  sunset: Date;
  horaLord: string;
  dishaShool: string;
  ayanamsa: number;
};

/**
 * The Panchang for a day at a place.
 *
 * `dayStart` is local midnight expressed as a UTC instant. The five limbs are
 * evaluated at sunrise, which is where the Hindu day begins - taking them at
 * midnight would report the previous day's tithi for the first hours of every
 * morning.
 */
export function computePanchang(
  dayStart: Date,
  latitude: number,
  longitudeEast: number,
): PanchangElements {
  const { sunrise, sunset } = sunTimes(dayStart, latitude, longitudeEast);
  const jdTT = terrestrialTime(sunrise);

  const sunLongitude = apparentPosition("sun", jdTT).longitude;
  const moonLongitude = moonPosition(jdTT).longitude;

  // How far the Moon has pulled ahead of the Sun. Every lunar element below
  // is a division of this one angle.
  const elongation = normalizeDegrees(moonLongitude - sunLongitude);

  const tithiIndex = Math.floor(elongation / 12);
  const karanaIndex = Math.floor(elongation / 6);
  const yogaIndex = Math.floor(normalizeDegrees(toSidereal(sunLongitude, jdTT) + toSidereal(moonLongitude, jdTT)) / (360 / 27));

  const weekday = varaIndexAt(sunrise, longitudeEast);
  const siderealMoon = toSidereal(moonLongitude, jdTT);

  return {
    tithi: {
      number: tithiIndex + 1,
      name: tithiName(tithiIndex),
      paksha: tithiIndex < 15 ? "Shukla" : "Krishna",
    },
    nakshatra: { name: getNakshatraName(siderealMoon), pada: getPada(siderealMoon) },
    yoga: { number: yogaIndex + 1, name: YOGA_NAMES[yogaIndex] },
    karana: { number: karanaIndex + 1, name: karanaName(karanaIndex) },
    vara: { name: VARA_NAMES[weekday], english: VARA_ENGLISH[weekday], lord: WEEKDAY_LORDS[weekday] },
    sunrise,
    sunset,
    horaLord: horaLordAt(sunrise, sunrise, sunset, weekday),
    dishaShool: DISHA_SHOOL[weekday],
    ayanamsa: lahiriAyanamsa(jdTT),
  };
}

/** The fifteenth tithi of each fortnight has its own name. */
function tithiName(index: number): string {
  if (index === 14) return "Purnima";
  if (index === 29) return "Amavasya";
  return TITHI_NAMES[index % 15];
}

/**
 * Karana names.
 *
 * Sixty karanas fill a lunar month. The first is fixed, then the seven movable
 * ones repeat eight times, then three more fixed ones close the month.
 */
function karanaName(index: number): string {
  if (index === 0) return FIXED_KARANAS.first;
  if (index >= 57) return FIXED_KARANAS.last[index - 57];
  return MOVABLE_KARANAS[(index - 1) % 7];
}

/**
 * The weekday, counted the Hindu way.
 *
 * The day belongs to whichever weekday was current at its sunrise, in local
 * time. Using the UTC weekday would put the boundary in the middle of the
 * night at most longitudes and change the answer for anyone born near it.
 */
function varaIndexAt(sunrise: Date, longitudeEast: number): number {
  // Local mean time at the meridian, which is what the traditional day follows.
  const localMs = sunrise.getTime() + (longitudeEast / 15) * 3600000;
  return new Date(localMs).getUTCDay();
}

/**
 * The planetary hour, or hora.
 *
 * Daylight is divided into twelve unequal hours, the first ruled by the lord
 * of the weekday, and the rest following the Chaldean order.
 */
function horaLordAt(at: Date, sunrise: Date, sunset: Date, weekday: number): string {
  const dayLength = sunset.getTime() - sunrise.getTime();
  const elapsed = at.getTime() - sunrise.getTime();
  const hour = Math.max(0, Math.min(11, Math.floor((elapsed / dayLength) * 12)));

  const start = HORA_ORDER.indexOf(WEEKDAY_LORDS[weekday] as (typeof HORA_ORDER)[number]);
  return HORA_ORDER[(start + hour) % HORA_ORDER.length];
}

/** Fields a traditional Panchang carries that this engine does not calculate. */
export const PANCHANG_UNAVAILABLE_FIELDS = [
  "Lunar month (Amanta and Purnimanta names differ by region and are not calculated)",
  "Moonrise and moonset",
  "Choghadiya",
] as const;
