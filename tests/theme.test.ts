import { describe, expect, it } from "vitest";
import { isThemePreference, resolveThemePreference } from "@/lib/theme";

describe("theme helpers", () => {
  it("accepts only supported theme preferences", () => {
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("midnight")).toBe(false);
  });

  it("resolves system preference from the current OS theme", () => {
    expect(resolveThemePreference("system", "dark")).toBe("dark");
    expect(resolveThemePreference("system", "light")).toBe("light");
    expect(resolveThemePreference("dark", "light")).toBe("dark");
    expect(resolveThemePreference("light", "dark")).toBe("light");
  });
});

