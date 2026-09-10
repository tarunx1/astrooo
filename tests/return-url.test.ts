import { describe, expect, it } from "vitest";
import { DEFAULT_RETURN_TO, buildSignInHref, isSafeReturnTo, sanitizeReturnTo } from "@/lib/auth/return-url";

describe("return URL validation", () => {
  it("accepts internal application destinations", () => {
    const allowed = [
      "/",
      "/account",
      "/account/birth-profiles",
      "/kundli/result/2f1c9d4e-6a3b-4c1e-9f7a-1b2c3d4e5f60",
      "/kundli?tab=chart",
      "/kundli/result/abc#planets",
    ];

    for (const value of allowed) {
      expect(isSafeReturnTo(value), value).toBe(true);
    }
  });

  it("rejects absolute URLs to other origins", () => {
    const blocked = [
      "https://evil.example.com",
      "http://evil.example.com/account",
      "//evil.example.com",
      "///evil.example.com",
      "https://tarun-astro.internal.evil.example.com",
    ];

    for (const value of blocked) {
      expect(isSafeReturnTo(value), value).toBe(false);
    }
  });

  it("rejects scheme payloads", () => {
    const blocked = ["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,<script>", "vbscript:msgbox(1)"];

    for (const value of blocked) {
      expect(isSafeReturnTo(value), value).toBe(false);
    }
  });

  it("rejects backslash and encoded separator bypasses", () => {
    const blocked = ["/\\evil.example.com", "\\\\evil.example.com", "/%2f%2fevil.example.com", "/%5cevil.example.com"];

    for (const value of blocked) {
      expect(isSafeReturnTo(value), value).toBe(false);
    }
  });

  it("rejects control characters browsers would strip", () => {
    const blocked = [
      `/${String.fromCharCode(9)}//evil.example.com`,
      `/${String.fromCharCode(10)}//evil.example.com`,
      `${String.fromCharCode(0)}/account`,
      " /account",
    ];

    for (const value of blocked) {
      expect(isSafeReturnTo(value), JSON.stringify(value)).toBe(false);
    }
  });

  it("rejects relative paths and non-strings", () => {
    expect(isSafeReturnTo("account")).toBe(false);
    expect(isSafeReturnTo("../account")).toBe(false);
    expect(isSafeReturnTo("")).toBe(false);
    expect(isSafeReturnTo(undefined)).toBe(false);
    expect(isSafeReturnTo(null)).toBe(false);
    expect(isSafeReturnTo(42)).toBe(false);
    expect(isSafeReturnTo(`/${"a".repeat(600)}`)).toBe(false);
  });

  it("falls back to a safe default rather than following a hostile value", () => {
    expect(sanitizeReturnTo("https://evil.example.com")).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo("//evil.example.com")).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo("/account/kundlis")).toBe("/account/kundlis");
    expect(sanitizeReturnTo(undefined, "/kundli")).toBe("/kundli");
  });

  it("never builds a sign-in link that points off-site", () => {
    expect(buildSignInHref("https://evil.example.com")).toBe("/sign-in");
    expect(buildSignInHref("//evil.example.com")).toBe("/sign-in");
    expect(buildSignInHref("/account/kundlis")).toBe("/sign-in?returnTo=%2Faccount%2Fkundlis");
  });
});
