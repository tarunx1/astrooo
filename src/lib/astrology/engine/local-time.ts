/**
 * Turning a birth record into an instant.
 *
 * A birth is written down as a wall clock reading and a place. Converting that
 * to a moment in time needs the zone's history, because offsets change: India
 * has had several, and much of the world moves twice a year. Getting this
 * wrong shifts the ascendant by fifteen degrees an hour, which is a different
 * chart entirely - and the error looks completely ordinary.
 */

/** The zone's offset from UTC in minutes at a given instant, from the platform's own tz database. */
function offsetMinutesAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const zone = parts.find((part) => part.type === "timeZoneName")?.value;
  const match = zone?.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  // GMT with no offset is UTC itself, which formatToParts writes as "GMT".
  if (!match) {
    if (zone === "GMT") return 0;
    throw new Error(`Could not resolve a UTC offset for time zone ${timeZone}.`);
  }

  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? "0"));
}

/**
 * The UTC instant of a local date and time in a named zone.
 *
 * Solved by iteration rather than in one step, because the offset depends on
 * the instant and the instant depends on the offset. Three passes settle every
 * real zone, including the ones with half-hour and three-quarter-hour offsets.
 *
 * A wall clock reading inside a spring-forward gap never happened, and one
 * inside an autumn fall-back happened twice. This resolves both to a single
 * definite instant rather than refusing: a birth certificate says what it says,
 * and the alternative is failing to draw a chart at all.
 */
export function utcInstantOf(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    throw new Error(`Could not read a date and time from "${date}" and "${time}".`);
  }

  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let instant = new Date(wallClockAsUtc);
  for (let pass = 0; pass < 3; pass += 1) {
    instant = new Date(wallClockAsUtc - offsetMinutesAt(instant, timeZone) * 60000);
  }
  return instant;
}
