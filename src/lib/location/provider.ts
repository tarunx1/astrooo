import type { LocationSuggestion, ResolvedLocation } from "@/lib/kundli/types";

export interface LocationProvider {
  search(query: string): Promise<LocationSuggestion[]>;
  resolve(placeId: string): Promise<ResolvedLocation | null>;
}

export const developmentLocations: ResolvedLocation[] = [
  {
    placeId: "dev:new-delhi-in",
    displayName: "New Delhi, Delhi, India",
    city: "New Delhi",
    region: "Delhi",
    country: "India",
    latitude: 28.613939,
    longitude: 77.209023,
    timezone: "Asia/Kolkata",
  },
  {
    placeId: "dev:amritsar-in",
    displayName: "Amritsar, Punjab, India",
    city: "Amritsar",
    region: "Punjab",
    country: "India",
    latitude: 31.634,
    longitude: 74.8723,
    timezone: "Asia/Kolkata",
  },
  {
    placeId: "dev:mumbai-in",
    displayName: "Mumbai, Maharashtra, India",
    city: "Mumbai",
    region: "Maharashtra",
    country: "India",
    latitude: 19.076,
    longitude: 72.8777,
    timezone: "Asia/Kolkata",
  },
  {
    placeId: "dev:london-gb",
    displayName: "London, England, United Kingdom",
    city: "London",
    region: "England",
    country: "United Kingdom",
    latitude: 51.5072,
    longitude: -0.1276,
    timezone: "Europe/London",
  },
  {
    placeId: "dev:toronto-ca",
    displayName: "Toronto, Ontario, Canada",
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
    latitude: 43.6532,
    longitude: -79.3832,
    timezone: "America/Toronto",
  },
];

type OpenMeteoItem = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
  admin1?: string;
  admin2?: string;
};

/**
 * Worldwide location provider using Open-Meteo's open geocoding API,
 * providing accurate global coverage with exact coordinates and IANA timezones.
 * Falls back to development fixtures if offline or for test consistency.
 */
export class WorldwideLocationProvider implements LocationProvider {
  async search(query: string): Promise<LocationSuggestion[]> {
    const normalized = query.trim();
    if (normalized.length < 2) return [];

    const lower = normalized.toLowerCase();
    const devMatches = developmentLocations
      .filter((loc) => loc.displayName.toLowerCase().includes(lower) || loc.city.toLowerCase().includes(lower))
      .map(({ placeId, displayName, city, region, country }) => ({ placeId, displayName, city, region, country }));

    try {
      const endpoint = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(normalized)}&count=10&language=en&format=json`;
      const response = await fetch(endpoint, {
        headers: { "User-Agent": "TarunAstro/1.0" },
        signal: AbortSignal.timeout(4000),
      });

      if (!response.ok) {
        return devMatches;
      }

      const data = (await response.json()) as { results?: OpenMeteoItem[] };
      if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
        return devMatches;
      }

      const suggestions: LocationSuggestion[] = data.results.map((item) => {
        const city = item.name;
        const region = item.admin1 || item.admin2 || "";
        const country = item.country || "India";
        const displayName = [city, region, country].filter(Boolean).join(", ");
        const timezone = item.timezone || "Asia/Kolkata";

        // Embed geocoding coordinates and timezone directly into the placeId
        const placeId = `geo:v1:${item.latitude}:${item.longitude}:${encodeURIComponent(timezone)}:${encodeURIComponent(city)}:${encodeURIComponent(region)}:${encodeURIComponent(country)}`;

        return {
          placeId,
          displayName,
          city,
          region: region || undefined,
          country,
        };
      });

      // Include dev matches if not already present
      for (const dev of devMatches) {
        if (!suggestions.some((s) => s.displayName.toLowerCase() === dev.displayName.toLowerCase())) {
          suggestions.push(dev);
        }
      }

      return suggestions.slice(0, 10);
    } catch {
      return devMatches;
    }
  }

  async resolve(placeId: string): Promise<ResolvedLocation | null> {
    // 1. Resolve development fixture placeIds (dev:...)
    const dev = developmentLocations.find((loc) => loc.placeId === placeId);
    if (dev) return dev;

    // 2. Decode stateless global placeIds (geo:v1:lat:lon:tz:city:region:country)
    if (placeId.startsWith("geo:v1:")) {
      try {
        const parts = placeId.split(":");
        if (parts.length >= 8) {
          const latitude = parseFloat(parts[2]);
          const longitude = parseFloat(parts[3]);
          const timezone = decodeURIComponent(parts[4]);
          const city = decodeURIComponent(parts[5]);
          const region = decodeURIComponent(parts[6]);
          const country = decodeURIComponent(parts[7]);
          const displayName = [city, region, country].filter(Boolean).join(", ");

          if (Number.isFinite(latitude) && Number.isFinite(longitude) && timezone && city) {
            return {
              placeId,
              displayName,
              city,
              region: region || undefined,
              country,
              latitude,
              longitude,
              timezone,
            };
          }
        }
      } catch {
        return null;
      }
    }

    return null;
  }
}

export class DevelopmentLocationProvider extends WorldwideLocationProvider {}

export function getLocationProvider(): LocationProvider {
  return new WorldwideLocationProvider();
}
