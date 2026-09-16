import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Color } from "three";

/**
 * The globe reads its colours from CSS custom properties and hands them
 * straight to three.js. That crosses a boundary two languages disagree about:
 * CSS Color 4 allows `rgb(21 33 55 / 0.94)`, and `Color.setStyle` does not
 * parse it - it **silently falls back to white** rather than throwing.
 *
 * That is exactly the bug this guards. White land dots on a pale ocean are
 * invisible, the globe still renders, nothing logs, and the only symptom is a
 * blank disc. A token changed to a perfectly valid CSS colour could reintroduce
 * it at any time, so every globe colour token is parsed here.
 */
const tokens = readFileSync(path.join(process.cwd(), "src/styles/tokens.css"), "utf8");
const component = readFileSync(
  path.join(process.cwd(), "src/components/analytics/user-globe.tsx"),
  "utf8",
);

/**
 * The tokens the component actually hands to three.js.
 *
 * Read out of the source rather than listed here, so adding a colour to
 * `readGlobePalette` brings it under this check automatically. Tokens used only
 * in CSS - `--globe-shadow` among them - are the browser's to parse and are
 * correctly left alone; that distinction is the whole reason this is scoped
 * rather than sweeping every `--globe-*`.
 */
function tokensPassedToThree(): string[] {
  return [...component.matchAll(/token\("(--globe-[a-z-]+)"\)/g)].map((match) => match[1]);
}

/** Every declared value for a token, with the line it sits on. */
function declarationsOf(name: string): Array<{ value: string; line: number }> {
  const found: Array<{ value: string; line: number }> = [];

  tokens.split("\n").forEach((text, index) => {
    const match = text.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
    if (!match) return;

    const value = match[1].trim();
    // A token deferring to another variable is resolved by the browser.
    if (value.startsWith("var(")) return;
    found.push({ value, line: index + 1 });
  });

  return found;
}

function globeColourTokens(): Array<{ name: string; value: string; line: number }> {
  return tokensPassedToThree().flatMap((name) =>
    declarationsOf(name).map((entry) => ({ name, ...entry })),
  );
}

describe("globe colour tokens", () => {
  const colours = globeColourTokens();

  it("finds the tokens the component hands to three", () => {
    expect(tokensPassedToThree()).toContain("--globe-land");
    expect(tokensPassedToThree()).toContain("--globe-ocean");
    // Both themes declare each one, so there is more than one value apiece.
    expect(colours.length).toBeGreaterThan(tokensPassedToThree().length);
  });

  it("leaves CSS-only tokens alone", () => {
    // --globe-shadow legitimately uses CSS Color 4 syntax; the browser parses
    // it and three never sees it.
    expect(tokensPassedToThree()).not.toContain("--globe-shadow");
  });

  it("are all parseable by three.js", () => {
    for (const { name, value, line } of colours) {
      const colour = new Color();
      colour.setStyle(value);

      // White is three's fallback for anything it cannot read. A token that is
      // genuinely white would be suspicious on a globe anyway.
      expect(
        `#${colour.getHexString()}`,
        `${name} at tokens.css:${line} is "${value}", which three.js cannot parse — it falls back to white`,
      ).not.toBe("#ffffff");
    }
  });

  it("rejects the CSS Color 4 syntax that caused this", () => {
    // Proof the check above can actually fail, rather than passing vacuously.
    const colour = new Color();
    colour.setStyle("rgb(21 33 55 / 0.94)");
    expect(`#${colour.getHexString()}`).toBe("#ffffff");
  });
});
