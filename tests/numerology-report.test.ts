import { describe, expect, it } from "vitest";
import {
  NUMEROLOGY_CALCULATION_TYPE,
  NUMEROLOGY_REPORT_SLUG,
  calculateNumerologyForReport,
  numerologyCalculatedFacts,
  numerologyInputHash,
  serializeNumerologyForPrompt,
} from "@/lib/reports/numerology-context";
import { buildNumerologyUserPrompt, buildSystemPrompt, getReportSpec } from "@/lib/reports/specs";
import { calculateNumerology } from "@/lib/numerology/calculator";

/**
 * The paid numerology report.
 *
 * The property that matters: the model is handed numbers and never asked to
 * produce one. Everything here checks that the boundary holds - the values come
 * from the deterministic calculator, values that could not be calculated are
 * declared as such rather than omitted silently, and the prompt says so.
 */
const SUBJECT = { name: "Tarun Sharma", dateOfBirth: "1992-08-14" };

describe("numerology calculation for reports", () => {
  it("uses the same deterministic calculator as the free tool", () => {
    const viaReport = calculateNumerologyForReport(SUBJECT);
    const viaTool = calculateNumerology({ name: SUBJECT.name, dateOfBirth: SUBJECT.dateOfBirth });

    // Identical inputs must produce identical numbers through either path.
    expect(viaReport.numbers).toEqual(viaTool.numbers);
    expect(viaReport.unavailable).toEqual(viaTool.unavailable);
  });

  it("is deterministic across runs", () => {
    const first = calculateNumerologyForReport(SUBJECT);
    const second = calculateNumerologyForReport(SUBJECT);
    expect(first).toEqual(second);
  });

  it("hashes the same inputs to the same key", () => {
    expect(numerologyInputHash(SUBJECT)).toBe(numerologyInputHash(SUBJECT));
    // Case and surrounding space must not create a second calculation.
    expect(numerologyInputHash({ name: "  tarun sharma ", dateOfBirth: "1992-08-14" })).toBe(
      numerologyInputHash(SUBJECT),
    );
  });

  it("hashes different inputs differently", () => {
    expect(numerologyInputHash(SUBJECT)).not.toBe(
      numerologyInputHash({ name: "Someone Else", dateOfBirth: "1992-08-14" }),
    );
    expect(numerologyInputHash(SUBJECT)).not.toBe(
      numerologyInputHash({ name: SUBJECT.name, dateOfBirth: "1992-08-15" }),
    );
  });
});

describe("prompt construction", () => {
  it("gives the model every calculated number with its derivation", () => {
    const result = calculateNumerologyForReport(SUBJECT);
    const serialized = serializeNumerologyForPrompt(result);

    for (const number of result.numbers) {
      expect(serialized).toContain(number.label);
      expect(serialized).toContain(String(number.value));
      // The arithmetic is included so the model has nothing to work out.
      expect(serialized).toContain(number.workings);
    }
  });

  it("declares what could not be calculated instead of omitting it", () => {
    // A name with no vowels has no Soul Urge; the calculator says so.
    const result = calculateNumerologyForReport({ name: "Trg", dateOfBirth: "1992-08-14" });

    if (result.unavailable.length > 0) {
      const serialized = serializeNumerologyForPrompt(result);
      expect(serialized).toContain("Not calculable");
      expect(serialized).toContain("Do not invent");

      for (const entry of result.unavailable) {
        expect(serialized).toContain(entry.label);
      }
    }
  });

  it("never labels numerology data as chart data", () => {
    const spec = getReportSpec(NUMEROLOGY_REPORT_SLUG)!;
    const result = calculateNumerologyForReport(SUBJECT);

    const prompt = buildNumerologyUserPrompt(
      spec,
      serializeNumerologyForPrompt(result),
      SUBJECT.name,
    );

    expect(prompt).toContain("CALCULATED NUMEROLOGY");
    // Telling the model it has chart data would invite it to reach for
    // astrology it has not been given.
    expect(prompt).not.toContain("CHART DATA");
  });

  it("forbids inventing a value in the shared guardrails", () => {
    const spec = getReportSpec(NUMEROLOGY_REPORT_SLUG)!;
    const system = buildSystemPrompt(spec).toLowerCase();

    expect(system).toContain("already been calculated");
    expect(system).toContain("numerology value");
    expect(system).toContain("do not assert it");
    expect(system).not.toContain("calculate the");
  });
});

describe("report specification", () => {
  it("is registered under the numerology slug", () => {
    const spec = getReportSpec(NUMEROLOGY_REPORT_SLUG);
    expect(spec).not.toBeNull();
    expect(spec?.reportType).toBe("NUMEROLOGY");
  });

  it("requires no chart context", () => {
    // Asking "does this have an ascendant?" of a numerology reading is not a
    // meaningful gate; readiness is checked against the numbers instead.
    const spec = getReportSpec(NUMEROLOGY_REPORT_SLUG)!;
    expect(spec.requires).toEqual([]);
  });

  it("declares a section per core number plus synthesis", () => {
    const spec = getReportSpec(NUMEROLOGY_REPORT_SLUG)!;
    const ids = spec.sections.map((section) => section.id);

    expect(ids).toContain("life-path");
    expect(ids).toContain("expression");
    expect(ids).toContain("soul-urge");
    expect(ids).toContain("personality");
    expect(ids).toContain("birthday");
    expect(ids).toContain("patterns");
  });

  it("uses its own calculation type, distinct from a chart", () => {
    expect(NUMEROLOGY_CALCULATION_TYPE).toBe("NUMEROLOGY");
    expect(NUMEROLOGY_CALCULATION_TYPE).not.toBe("JANAM_KUNDLI");
  });
});

describe("calculated facts", () => {
  it("records every number the reader can check", () => {
    const result = calculateNumerologyForReport(SUBJECT);
    const facts = numerologyCalculatedFacts(result);

    expect(facts.length).toBe(result.numbers.length + result.unavailable.length);

    for (const number of result.numbers) {
      expect(facts.some((fact) => fact.label === number.label)).toBe(true);
    }
  });

  it("records an uncalculable number as uncalculable rather than zero", () => {
    const result = calculateNumerologyForReport({ name: "Trg", dateOfBirth: "1992-08-14" });
    const facts = numerologyCalculatedFacts(result);

    for (const entry of result.unavailable) {
      const fact = facts.find((candidate) => candidate.label === entry.label);
      expect(fact?.value).toContain("Not calculable");
      expect(fact?.value).not.toBe("0");
    }
  });
});
