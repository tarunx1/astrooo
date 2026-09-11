import "server-only";

import { createHash } from "node:crypto";
import { calculateNumerology } from "@/lib/numerology/calculator";
import type { NumerologyResult } from "@/lib/numerology/types";

/**
 * Numerology as report input.
 *
 * The numbers come from the existing deterministic calculator - the same one
 * behind the free tool - computed once, stored on an `AstrologyCalculation`
 * row, and handed to the report as facts. The AI narrates them; it never
 * derives one. Persisting the calculation rather than recomputing it inside the
 * renderer is what lets a delivered report always be traced back to the exact
 * numbers it was written from.
 *
 * The calculator already reports what it *could not* compute, with a reason -
 * a name with no vowels has no Soul Urge. That list is carried into the prompt
 * verbatim, so the model is told which numbers do not exist rather than being
 * left to invent them.
 */
export const NUMEROLOGY_CALCULATION_TYPE = "NUMEROLOGY";
export const NUMEROLOGY_REPORT_SLUG = "numerology";

export type NumerologyReportInput = {
  name: string;
  dateOfBirth: string;
};

/**
 * A stable hash of the inputs.
 *
 * Matches how Kundli calculations are deduplicated: the same name and date
 * resolve to the same stored calculation rather than creating a row per order.
 */
export function numerologyInputHash(input: NumerologyReportInput): string {
  return createHash("sha256")
    .update(`${NUMEROLOGY_CALCULATION_TYPE}|${input.name.trim().toLowerCase()}|${input.dateOfBirth}`)
    .digest("hex");
}

/** Runs the calculator. Deterministic; no provider call and no model. */
export function calculateNumerologyForReport(input: NumerologyReportInput): NumerologyResult {
  return calculateNumerology({ name: input.name, dateOfBirth: input.dateOfBirth });
}

/**
 * The facts, serialized for the prompt.
 *
 * A closed list: the model is given the numbers that exist, the arithmetic
 * behind each, and an explicit statement of which ones could not be calculated
 * and why. There is nothing left for it to compute, which is the point.
 */
export function serializeNumerologyForPrompt(result: NumerologyResult): string {
  const lines = [
    `Subject: ${result.name ?? "Not given"}`,
    `Date of birth: ${result.dateOfBirth}`,
    `System: ${result.system}`,
    "",
    "Calculated numbers. These are the only numbers that exist for this reading:",
  ];

  for (const number of result.numbers) {
    lines.push(
      `- ${number.label}: ${number.value}${number.isMasterNumber ? " (master number)" : ""}`,
      `    traditionally ruled by ${number.ruler}`,
      `    derived as ${number.workings}`,
    );
  }

  if (result.unavailable.length > 0) {
    lines.push("", "Not calculable for this input. Do not invent, estimate or refer to these:");
    for (const entry of result.unavailable) {
      lines.push(`- ${entry.label}: ${entry.reason}`);
    }
  }

  return lines.join("\n");
}

/**
 * The facts as the document's calculated-facts block.
 *
 * Mirrors what a chart report stores, so a numerology report carries the same
 * kind of auditable record of what it was written from.
 */
export function numerologyCalculatedFacts(
  result: NumerologyResult,
): Array<{ label: string; value: string }> {
  const facts = result.numbers.map((number) => ({
    label: number.label,
    value: `${number.value}${number.isMasterNumber ? " (master)" : ""} — ${number.ruler}`,
  }));

  for (const entry of result.unavailable) {
    facts.push({ label: entry.label, value: `Not calculable: ${entry.reason}` });
  }

  return facts;
}
