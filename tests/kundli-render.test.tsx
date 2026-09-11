import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DevelopmentAstrologyProvider } from "@/lib/astrology/provider";
import { KundliOverview, PlanetaryPositionsTable } from "@/components/kundli/result-sections";
import { normalizeBirthDetails } from "@/lib/kundli/normalize";

describe("Kundli result rendering", () => {
  it("renders overview and planet table content", async () => {
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
    const result = await new DevelopmentAstrologyProvider().calculateKundli(input);
    const markup = renderToStaticMarkup(
      <>
        <KundliOverview result={result} />
        <PlanetaryPositionsTable result={result} />
      </>,
    );

    expect(markup).toContain("Tarun Sharma");
    expect(markup).toContain("Planetary Positions");
    expect(markup).toContain("Sun");
  });
});
