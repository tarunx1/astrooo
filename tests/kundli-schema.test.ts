import { describe, expect, it } from "vitest";
import { birthDetailsSchema, resolvedLocationSchema } from "@/lib/kundli/schema";

const validInput = {
  name: "Ravish Sharma",
  dateOfBirth: "1992-08-14",
  timeOfBirth: "06:35",
  timeAccuracy: "EXACT",
  placeId: "dev:amritsar-in",
};

describe("birthDetailsSchema", () => {
  it("accepts valid birth details without trusting browser coordinates", () => {
    expect(birthDetailsSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects impossible calendar dates", () => {
    const result = birthDetailsSchema.safeParse({ ...validInput, dateOfBirth: "1992-02-31" });
    expect(result.success).toBe(false);
  });

  it("rejects unresolved place IDs", () => {
    const result = birthDetailsSchema.safeParse({ ...validInput, placeId: "" });
    expect(result.success).toBe(false);
  });
});

describe("resolvedLocationSchema", () => {
  it("requires calculation-ready coordinates and timezone", () => {
    const result = resolvedLocationSchema.safeParse({
      displayName: "Amritsar, Punjab, India",
      city: "Amritsar",
      region: "Punjab",
      country: "India",
      latitude: 31.634,
      longitude: 74.8723,
      timezone: "Asia/Kolkata",
    });

    expect(result.success).toBe(true);
  });
});
