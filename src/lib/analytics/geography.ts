export type GeographyPrecision = "CITY" | "REGION" | "COUNTRY";

export type GeographyMarker = {
  id: string;
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country: string;
  count: number;
  precision: GeographyPrecision;
};

export type GeographySummary = {
  markers: GeographyMarker[];
  countries: Array<{ country: string; count: number }>;
  mappedUsers: number;
  unmappedUsers: number;
  cityCount: number;
  countryCount: number;
};

export type GeographyAggregateRow = {
  city: string | null;
  region: string | null;
  country: string;
  latitude: number;
  longitude: number;
  count: number;
};

const MAX_MARKERS = 200;

function clean(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function markerId(row: GeographyAggregateRow) {
  return [row.country, row.region, row.city]
    .map((part) => clean(part)?.toLocaleLowerCase("en") ?? "")
    .join(":");
}

/**
 * Converts database aggregates into the deliberately small, PII-free client
 * contract. Coordinates are rounded to roughly city precision before crossing
 * the server/client boundary; individual profile rows never leave the server.
 */
export function buildGeographySummary(
  rows: GeographyAggregateRow[],
  totalUsers: number,
): GeographySummary {
  const markers = rows
    .filter(
      (row) =>
        Number.isFinite(row.latitude) &&
        Number.isFinite(row.longitude) &&
        row.latitude >= -90 &&
        row.latitude <= 90 &&
        row.longitude >= -180 &&
        row.longitude <= 180 &&
        row.count > 0,
    )
    .map((row) => {
      const city = clean(row.city);
      const region = clean(row.region);
      return {
        id: markerId(row),
        latitude: Math.round(row.latitude * 100) / 100,
        longitude: Math.round(row.longitude * 100) / 100,
        city,
        region,
        country: clean(row.country) ?? "Unknown",
        count: Math.round(row.count),
        precision: city ? "CITY" : region ? "REGION" : "COUNTRY",
      } satisfies GeographyMarker;
    })
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, MAX_MARKERS);

  const countriesByName = new Map<string, number>();
  let mappedUsers = 0;
  for (const marker of markers) {
    mappedUsers += marker.count;
    countriesByName.set(marker.country, (countriesByName.get(marker.country) ?? 0) + marker.count);
  }

  const countries = [...countriesByName]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));

  return {
    markers,
    countries,
    mappedUsers,
    unmappedUsers: Math.max(0, totalUsers - mappedUsers),
    cityCount: markers.filter((marker) => marker.precision === "CITY").length,
    countryCount: countries.length,
  };
}

