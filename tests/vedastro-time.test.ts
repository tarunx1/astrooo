import { describe, expect, it } from "vitest";
import { getHistoricalUtcOffset, toVedAstroTime } from "@/lib/astrology/providers/vedastro-time";
import { normalizeBirthDetails } from "@/lib/kundli/normalize";

describe("VedAstro time mapping", () => {
  it("formats VedAstro StdTime with historical IANA timezone offsets", () => {
    expect(getHistoricalUtcOffset("1992-10-25", "14:30", "Asia/Kolkata")).toBe("+05:30");
    expect(getHistoricalUtcOffset("2026-07-11", "12:00", "America/New_York")).toBe("-04:00");
    expect(getHistoricalUtcOffset("2026-01-11", "12:00", "America/New_York")).toBe("-05:00");
    expect(getHistoricalUtcOffset("2026-01-11", "12:00", "Australia/Adelaide")).toBe("+10:30");
    expect(getHistoricalUtcOffset("2026-07-11", "12:00", "Australia/Adelaide")).toBe("+09:30");
  });

  it("maps normalized birth details into VedAstro's required time and location shape", () => {
    const input = normalizeBirthDetails({
      name: "Ravish Sharma",
      dateOfBirth: "1992-10-25",
      timeOfBirth: "14:30",
      timeAccuracy: "EXACT",
      placeId: "dev:mumbai-in",
      displayName: "Mumbai, Maharashtra, India",
      city: "Mumbai",
      country: "India",
      latitude: 19.076,
      longitude: 72.8777,
      timezone: "Asia/Kolkata",
    });

    expect(toVedAstroTime(input)).toEqual({
      StdTime: "14:30 25/10/1992 +05:30",
      Location: {
        Name: "Mumbai, Maharashtra, India",
        Longitude: 72.8777,
        Latitude: 19.076,
      },
    });
  });
});
