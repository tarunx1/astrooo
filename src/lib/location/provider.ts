import type { LocationSuggestion, ResolvedLocation } from "@/lib/kundli/types";

export interface LocationProvider {
  search(query: string): Promise<LocationSuggestion[]>;
  resolve(placeId: string): Promise<ResolvedLocation | null>;
}

const developmentLocations: ResolvedLocation[] = [
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

export class DevelopmentLocationProvider implements LocationProvider {
  async search(query: string) {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length < 2) return [];

    return developmentLocations
      .filter((location) => location.displayName.toLowerCase().includes(normalizedQuery) || location.city.toLowerCase().includes(normalizedQuery))
      .slice(0, 6)
      .map(({ placeId, displayName, city, region, country }) => ({ placeId, displayName, city, region, country }));
  }

  async resolve(placeId: string) {
    return developmentLocations.find((location) => location.placeId === placeId) ?? null;
  }
}

export function getLocationProvider(): LocationProvider {
  return new DevelopmentLocationProvider();
}
