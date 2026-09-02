import { describe, expect, it } from "vitest";
import { DevelopmentAstrologyProvider } from "@/lib/astrology/provider";
import { normalizeBirthDetails } from "@/lib/kundli/normalize";
import { canAccessKundliResult, findKundliByHash, persistKundliCalculation } from "@/lib/kundli/store";

describe("Kundli storage foundation", () => {
  it("caches calculations by deterministic input hash and supports anonymous access", async () => {
    const input = normalizeBirthDetails({
      name: "Ravish Sharma",
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
    const result = await new DevelopmentAstrologyProvider().calculateKundli(input);

    const stored = await persistKundliCalculation({ input, result });
    const cached = await findKundliByHash(result.metadata.inputHash);

    expect(cached?.id).toBe(stored.id);
    expect(await canAccessKundliResult(stored.id)).toBe(true);
  });
});
