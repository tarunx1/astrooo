import { z } from "zod";

/**
 * Versioned internal report document.
 *
 * This is the contract every generated report must satisfy before it is
 * persisted. AI output that does not parse cleanly is a failed generation, not a
 * report: arbitrary unvalidated prose is never stored as a success.
 *
 * Bump REPORT_SCHEMA_VERSION whenever the shape changes so that stored documents
 * remain interpretable against the schema that produced them.
 */
export const REPORT_SCHEMA_VERSION = "1.0.0";

/**
 * Facts are copied verbatim from the deterministic KundliResult, never authored
 * by a model. They are kept separate from interpretation so a reader (and a
 * reviewer) can always tell which is which.
 */
export const calculatedFactSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(240),
});

export const reportSectionSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Section ids are lowercase kebab-case."),
  title: z.string().trim().min(3).max(140),
  summary: z.string().trim().min(20).max(600),
  content: z.string().trim().min(120).max(12_000),
  highlights: z.array(z.string().trim().min(3).max(240)).max(8).default([]),
});

export const reportDocumentSchema = z.object({
  schemaVersion: z.literal(REPORT_SCHEMA_VERSION),
  reportType: z.string().trim().min(1).max(64),

  metadata: z.object({
    subjectName: z.string().trim().min(1).max(120),
    generatedAt: z.string().datetime(),
    astrologyCalculationId: z.string().trim().min(1).max(64),
    calculationVersion: z.string().trim().min(1).max(64),
    ayanamsa: z.string().trim().min(1).max(64),
    houseSystem: z.string().trim().min(1).max(64),
    aiProvider: z.string().trim().min(1).max(64),
    aiModel: z.string().trim().min(1).max(120),
    promptVersion: z.string().trim().min(1).max(32),
  }),

  title: z.string().trim().min(3).max(160),
  introduction: z.string().trim().min(80).max(4_000),

  /** Deterministic values, lifted from the calculation rather than generated. */
  calculatedFacts: z.array(calculatedFactSchema).min(1).max(40),

  sections: z.array(reportSectionSchema).min(1).max(24),

  summary: z.string().trim().min(80).max(4_000),
  disclaimers: z.array(z.string().trim().min(10).max(600)).min(1).max(10),
});

export type CalculatedFact = z.infer<typeof calculatedFactSchema>;
export type ReportSection = z.infer<typeof reportSectionSchema>;
export type ReportDocument = z.infer<typeof reportDocumentSchema>;

/**
 * The portion the model is allowed to author. Facts and metadata are assembled
 * by us afterwards, so a model can never claim a planetary position.
 */
export const aiReportBodySchema = z.object({
  title: z.string().trim().min(3).max(160),
  introduction: z.string().trim().min(80).max(4_000),
  sections: z.array(reportSectionSchema).min(1).max(24),
  summary: z.string().trim().min(80).max(4_000),
});

export type AiReportBody = z.infer<typeof aiReportBodySchema>;

export const STANDARD_DISCLAIMERS: readonly string[] = [
  "This report is prepared for guidance and reflection. It is not a prediction of certain future events.",
  "Nothing in this report is medical, psychological, legal or financial advice. Please consult a qualified professional for those matters.",
  "Planetary positions and timings shown here are calculated deterministically. The interpretation around them is traditional Vedic commentary, not a scientific claim.",
  "You remain responsible for your own decisions. Please do not treat any part of this report as a guaranteed outcome.",
];
