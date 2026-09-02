import { describe, expect, it } from "vitest";
import { AstrologyProviderError } from "@/lib/astrology/errors";
import { VedAstroClient, unwrapVedAstroPayload } from "@/lib/astrology/providers/vedastro-client";

describe("VedAstroClient", () => {
  it("unwraps endpoint-nested successful payloads", () => {
    expect(unwrapVedAstroPayload("DasaAtTime", { DasaAtTime: { Jupiter: { Lord: "Jupiter" } } })).toEqual({
      Jupiter: { Lord: "Jupiter" },
    });
  });

  it("maps Status Fail to a typed provider error without leaking the raw string to users", async () => {
    const client = new VedAstroClient({
      retryCount: 0,
      fetchImpl: async () =>
        new Response(JSON.stringify({ Status: "Fail", Payload: "Could not parse birth time 'bad'" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    await expect(client.calculate("DasaAtTime", {})).rejects.toMatchObject({
      code: "VALIDATION",
      userMessage: "The birth details could not be calculated by the astrology provider. Please check the details and try again.",
    });
  });

  it("maps 429 responses to rate-limit errors", async () => {
    const client = new VedAstroClient({
      retryCount: 0,
      fetchImpl: async () => new Response(JSON.stringify({ Status: "Fail", Payload: "slow down" }), { status: 429 }),
    });

    await expect(client.calculate("AllPlanetData", {})).rejects.toBeInstanceOf(AstrologyProviderError);
    await expect(client.calculate("AllPlanetData", {})).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});
