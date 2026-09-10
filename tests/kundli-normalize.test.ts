import { describe, expect, it } from "vitest";
import { createKundliInputHash, normalizeBirthDetails } from "@/lib/kundli/normalize";

const baseInput = {
  name: "  Tarun   Sharma ",
  gender: "",
  dateOfBirth: "1992-08-14",
  timeOfBirth: "06:35",
  timeAccuracy: "EXACT" as const,
  placeId: "dev:amritsar-in",
  displayName: "Amritsar, Punjab, India",
  city: "Amritsar",
  region: "Punjab",
  country: "India",
  latitude: 31.6340002,
  longitude: 74.8723001,
  timezone: "Asia/Kolkata",
};

describe("Kundli normalization and hash", () => {
  it("normalizes names and coordinates", () => {
    const normalized = normalizeBirthDetails(baseInput);

    expect(normalized.name).toBe("Tarun Sharma");
    expect(normalized.location.latitude).toBe(31.634);
    expect(normalized.location.longitude).toBe(74.8723);
  });

  it("does not include display name in the deterministic calculation hash", () => {
    const first = normalizeBirthDetails(baseInput);
    const second = normalizeBirthDetails({ ...baseInput, name: "Someone Else", displayName: "Different display label" });

    expect(createKundliInputHash(first)).toBe(createKundliInputHash(second));
  });

  it("invalidates the deterministic hash when calculation config changes", () => {
    const input = normalizeBirthDetails(baseInput);
    const currentHash = createKundliInputHash(input);
    const changedVersionHash = createKundliInputHash(input, {
      ayanamsa: "LAHIRI",
      houseSystem: "WHOLE_SIGN",
      version: "tarun-kundli-v2",
    });
    const changedAyanamsaHash = createKundliInputHash(input, {
      ayanamsa: "RAMAN",
      houseSystem: "WHOLE_SIGN",
      version: "tarun-kundli-v1",
    });

    expect(changedVersionHash).not.toBe(currentHash);
    expect(changedAyanamsaHash).not.toBe(currentHash);
  });
});
