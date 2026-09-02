import type { NormalizedBirthDetails } from "@/lib/kundli/types";

export type VedAstroLocation = {
  Name: string;
  Longitude: number;
  Latitude: number;
};

export type VedAstroTime = {
  StdTime: string;
  Location: VedAstroLocation;
};

export function toVedAstroLocation(input: NormalizedBirthDetails): VedAstroLocation {
  return {
    Name: input.location.displayName,
    Longitude: input.location.longitude,
    Latitude: input.location.latitude,
  };
}

export function toVedAstroTime(input: NormalizedBirthDetails): VedAstroTime {
  const [year, month, day] = input.dateOfBirth.split("-");
  return {
    StdTime: `${input.timeOfBirth} ${day}/${month}/${year} ${getHistoricalUtcOffset(input.dateOfBirth, input.timeOfBirth, input.location.timezone)}`,
    Location: toVedAstroLocation(input),
  };
}

export function getHistoricalUtcOffset(date: string, time: string, timezone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localWallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utcInstant = new Date(localWallClockAsUtc);

  for (let index = 0; index < 3; index += 1) {
    const offsetMinutes = getOffsetMinutesAt(utcInstant, timezone);
    utcInstant = new Date(localWallClockAsUtc - offsetMinutes * 60_000);
  }

  return formatOffset(getOffsetMinutesAt(utcInstant, timezone));
}

function getOffsetMinutesAt(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const zone = parts.find((part) => part.type === "timeZoneName")?.value;
  const match = zone?.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) throw new Error(`Could not resolve timezone offset for ${timezone}.`);

  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? "0"));
}

function formatOffset(totalMinutes: number) {
  const sign = totalMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(totalMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}
