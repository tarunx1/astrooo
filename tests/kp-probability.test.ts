import { describe, expect, it } from "vitest";
import {
  calculateKpOccurrenceProbability,
  calculateKpRowProbability,
} from "@/lib/astrology/kp/probability";

describe("KP occurrence probability", () => {
  it("weights partial dasha, star, and sub-lord coverage", () => {
    expect(
      calculateKpRowProbability(
        {
          dashaLord: { houses: [2, 6] },
          starLord: { houses: [10] },
          subLord: { houses: [2, 10, 11] },
        },
        [2, 6, 10, 11],
      ),
    ).toEqual({ dashaLord: 10, starLord: 7.5, subLord: 37.5, probability: 55 });
  });

  it("returns 100 when every selected house is present for all three lords", () => {
    expect(
      calculateKpRowProbability(
        {
          dashaLord: { houses: [2, 6, 10, 11] },
          starLord: { houses: [2, 6, 10, 11] },
          subLord: { houses: [2, 6, 10, 11] },
        },
        [2, 6, 10, 11],
      ).probability,
    ).toBe(100);
  });

  it("gives each of three running rows an equal one-third share", () => {
    const result = calculateKpOccurrenceProbability(
      [
        { dashaLord: { houses: [2] }, starLord: { houses: [2] }, subLord: { houses: [2] } },
        { dashaLord: null, starLord: null, subLord: { houses: [2] } },
        { dashaLord: null, starLord: null, subLord: null },
      ],
      [2],
    );

    expect(result.rowWeight).toBe(33.3);
    expect(result.probability).toBe(50);
  });

  it("returns zero when no combination is selected", () => {
    expect(
      calculateKpOccurrenceProbability(
        [{ dashaLord: { houses: [2] }, starLord: { houses: [2] }, subLord: { houses: [2] } }],
        [],
      ).probability,
    ).toBe(0);
  });
});
