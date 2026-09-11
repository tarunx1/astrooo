import { describe, expect, it } from "vitest";
import { DevelopmentAstrologyProvider } from "@/lib/astrology/provider";
import { createKundliInputHash, normalizeBirthDetails } from "@/lib/kundli/normalize";

describe("DevelopmentAstrologyProvider", () => {
  it("maps deterministic fixture output into the internal KundliResult shape", async () => {
    const input = normalizeBirthDetails({
      name: "Tarun Sharma",
      dateOfBirth: "1992-08-14",
      timeOfBirth: "06:35",
      timeAccuracy: "EXACT",
      placeId: "dev:amritsar-in",
      displayName: "Amritsar, Punjab, India",
      city: "Amritsar",
      region: "Punjab",
      country: "India",
      latitude: 31.634,
      longitude: 74.8723,
      timezone: "Asia/Kolkata",
    });
    const provider = new DevelopmentAstrologyProvider();
    const result = await provider.calculateKundli(input);

    expect(result.metadata.inputHash).toBe(createKundliInputHash(input));
    expect(result.planets).toHaveLength(9);
    expect(result.chart.style).toBe("NORTH_INDIAN");
    expect(result.calculationMetadata.isDevelopmentFixture).toBe(true);
  });
});
