import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "@/lib/seo/json-ld";

/**
 * Structured data is embedded inside a <script> element, so serialising it is a
 * security boundary rather than a formatting detail.
 *
 * This exists because of a real finding: a product title containing a closing
 * script tag terminated the JSON-LD block on the live product page, and the
 * browser parsed the remainder as markup. Only the Content-Security-Policy
 * stopped the injected handler from running. These tests pin the escaping so
 * that cannot return.
 */
const CLOSING_SCRIPT = 'Probe</script><img src=x onerror="alert(1)">';

/** Mirrors how a browser finds the end of a script element. */
function blockIsTerminatedEarly(serialized: string): boolean {
  return /<\/script/i.test(serialized);
}

describe("serializeJsonLd", () => {
  it("makes it impossible to close the script element from inside a value", () => {
    const out = serializeJsonLd({ name: CLOSING_SCRIPT });

    expect(blockIsTerminatedEarly(out)).toBe(false);
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
  });

  it("is what plain JSON.stringify fails to do", () => {
    // Documents the actual defect rather than only the fix.
    expect(blockIsTerminatedEarly(JSON.stringify({ name: CLOSING_SCRIPT }))).toBe(true);
  });

  it("still parses back to exactly the original data", () => {
    const data = {
      name: CLOSING_SCRIPT,
      description: "Ampersands & angle < brackets > together",
      nested: { list: ["</SCRIPT>", "a&b"] },
      price: "100.00",
    };

    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it("escapes the separators that terminate a line for a JavaScript parser", () => {
    const out = serializeJsonLd({ name: "a b c" });

    expect(out).not.toContain(" ");
    expect(out).not.toContain(" ");
    expect(JSON.parse(out).name).toBe("a b c");
  });

  it("escapes a closing tag whatever its casing or spacing", () => {
    for (const payload of ["</script>", "</SCRIPT>", "</ScRiPt >", "</script\n>", "<!--<script>"]) {
      const out = serializeJsonLd({ name: payload });
      expect(blockIsTerminatedEarly(out), payload).toBe(false);
      expect(JSON.parse(out).name).toBe(payload);
    }
  });

  it("leaves ordinary structured data readable", () => {
    const out = serializeJsonLd({ "@context": "https://schema.org", "@type": "Product", name: "Rudraksha Mala" });
    expect(out).toContain("Rudraksha Mala");
    expect(out).toContain("schema.org");
  });
});
