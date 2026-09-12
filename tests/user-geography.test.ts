import { describe, expect, it } from "vitest";
import { buildGeographySummary } from "@/lib/analytics/geography";

describe("user geography analytics", () => {
  it("returns only aggregated, city-level marker data", () => {
    const result = buildGeographySummary(
      [
        {
          city: "Amritsar",
          region: "Punjab",
          country: "India",
          latitude: 31.634012,
          longitude: 74.872314,
          count: 31,
        },
      ],
      40,
    );

    expect(result.markers).toEqual([
      {
        id: "india:punjab:amritsar",
        city: "Amritsar",
        region: "Punjab",
        country: "India",
        latitude: 31.63,
        longitude: 74.87,
        count: 31,
        precision: "CITY",
      },
    ]);
    expect(result).toMatchObject({ mappedUsers: 31, unmappedUsers: 9, cityCount: 1, countryCount: 1 });
    expect(JSON.stringify(result)).not.toMatch(/email|phone|address|name/i);
  });

  it("drops invalid coordinates and orders aggregates by user count", () => {
    const result = buildGeographySummary(
      [
        { city: "London", region: null, country: "United Kingdom", latitude: 51.5, longitude: -0.12, count: 8 },
        { city: "Toronto", region: "Ontario", country: "Canada", latitude: 43.65, longitude: -79.38, count: 17 },
        { city: "Invalid", region: null, country: "Unknown", latitude: 120, longitude: 4, count: 99 },
      ],
      30,
    );

    expect(result.markers.map((marker) => marker.city)).toEqual(["Toronto", "London"]);
    expect(result.mappedUsers).toBe(25);
    expect(result.unmappedUsers).toBe(5);
  });

  it("handles an empty location dataset", () => {
    expect(buildGeographySummary([], 12)).toEqual({
      markers: [],
      countries: [],
      mappedUsers: 0,
      unmappedUsers: 12,
      cityCount: 0,
      countryCount: 0,
    });
  });
});
