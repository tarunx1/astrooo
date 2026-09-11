import { describe, expect, it } from "vitest";
import { DevelopmentInterpretationProvider, parseReportBody } from "@/lib/ai/interpretation";
import { buildCalculatedFacts, buildReportContext, serializeContextForPrompt } from "@/lib/reports/context";
import { REPORT_SCHEMA_VERSION, aiReportBodySchema, reportDocumentSchema } from "@/lib/reports/document";
import { PROMPT_VERSION, buildSystemPrompt, buildUserPrompt, getReportSpec, hasRequiredContext } from "@/lib/reports/specs";
import { DevelopmentAstrologyProvider } from "@/lib/astrology/provider";
import { normalizeBirthDetails } from "@/lib/kundli/normalize";
import type { KundliResult } from "@/lib/kundli/types";

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

const result: KundliResult = await new DevelopmentAstrologyProvider().calculateKundli(input);
const context = buildReportContext(result);

describe("report context builder", () => {
  it("projects the calculated chart, not raw birth details", () => {
    const serialized = serializeContextForPrompt(context);

    // The model gets the chart, never the birth date, time or coordinates.
    expect(serialized).not.toContain("1992-08-14");
    expect(serialized).not.toContain("06:35");
    expect(serialized).not.toContain("31.634");
    expect(serialized).not.toContain("74.8723");
    expect(serialized).not.toContain("Asia/Kolkata");

    expect(serialized).toContain(context.ascendant);
    expect(serialized).toContain("PLANETARY POSITIONS");
  });

  it("takes calculated facts from the calculation", () => {
    const facts = buildCalculatedFacts(context);
    const lagna = facts.find((fact) => fact.label === "Ascendant (Lagna)");
    const moon = facts.find((fact) => fact.label === "Moon Sign (Rashi)");

    expect(lagna?.value).toContain(result.ascendant.sign);
    expect(moon?.value).toBe(result.moonSign);
    expect(facts.length).toBeLessThanOrEqual(40);
  });
});

describe("prompt specifications", () => {
  it("defines a distinct spec per report type rather than one universal prompt", () => {
    const career = getReportSpec("career");
    const marriage = getReportSpec("love-marriage");

    expect(career).not.toBeNull();
    expect(marriage).not.toBeNull();
    expect(career!.sections.map((section) => section.id)).not.toEqual(marriage!.sections.map((section) => section.id));
  });

  it("carries the hallucination guardrails in every system prompt", () => {
    for (const slug of ["complete-life", "career", "love-marriage", "finance", "year-forecast"]) {
      const spec = getReportSpec(slug);
      expect(spec, slug).not.toBeNull();

      const prompt = buildSystemPrompt(spec!);
      expect(prompt, slug).toContain("NEVER invent");
      expect(prompt, slug).toContain("NO medical diagnosis");
      expect(prompt, slug).toContain("NO guaranteed financial outcome");
      expect(prompt, slug).toContain("NO legal advice");
      expect(prompt, slug).toContain("Do NOT predict death");
      expect(prompt, slug).toContain("Do NOT claim scientific proof");
      expect(prompt, slug).toContain("fear, threat or superstition");
    }
  });

  it("never asks the model to calculate astronomy", () => {
    const spec = getReportSpec("complete-life")!;
    const combined = `${buildSystemPrompt(spec)}\n${buildUserPrompt(spec, context)}`.toLowerCase();

    expect(combined).not.toContain("calculate the");
    expect(combined).not.toContain("compute the position");
    expect(combined).toContain("already been calculated");
    expect(combined).toContain("authoritative");
  });

  it("refuses to generate when required context is missing", () => {
    const spec = getReportSpec("career")!;
    expect(hasRequiredContext(spec, context)).toBe(true);

    const stripped = { ...context, planets: [], moonSign: "" };
    expect(hasRequiredContext(spec, stripped)).toBe(false);
  });
});

describe("AI output validation", () => {
  const validBody = {
    title: "A Grounded Reading",
    introduction: "x".repeat(120),
    summary: "y".repeat(120),
    sections: [
      {
        id: "personality",
        title: "Personality and Inner Nature",
        summary: "A sufficiently long section summary for validation purposes.",
        content: "z".repeat(200),
        highlights: ["One clear takeaway"],
      },
    ],
  };

  it("accepts a well-formed body", () => {
    expect(aiReportBodySchema.safeParse(validBody).success).toBe(true);
  });

  it("parses output wrapped in a markdown fence", () => {
    const fenced = "```json\n" + JSON.stringify(validBody) + "\n```";
    expect(parseReportBody(fenced, "test").title).toBe("A Grounded Reading");
  });

  it("rejects non-JSON output rather than storing prose", () => {
    expect(() => parseReportBody("Here is your report, friend!", "test")).toThrowError(/not valid JSON/);
  });

  it("rejects structurally invalid output", () => {
    const tooShort = { ...validBody, introduction: "too short" };
    expect(() => parseReportBody(JSON.stringify(tooShort), "test")).toThrowError(/schema validation/);
  });

  it("rejects a body with no sections", () => {
    const empty = { ...validBody, sections: [] };
    expect(() => parseReportBody(JSON.stringify(empty), "test")).toThrowError(/schema validation/);
  });
});

describe("report document", () => {
  it("requires the current schema version", () => {
    const document = {
      schemaVersion: "0.0.1",
      reportType: "CAREER",
      metadata: {
        subjectName: "Tarun Sharma",
        generatedAt: new Date().toISOString(),
        astrologyCalculationId: "calc-1",
        calculationVersion: "1",
        ayanamsa: "LAHIRI",
        houseSystem: "WHOLE_SIGN",
        aiProvider: "gemini",
        aiModel: "gemini-2.5-flash",
        promptVersion: PROMPT_VERSION,
      },
      title: "Career Reading",
      introduction: "x".repeat(120),
      calculatedFacts: [{ label: "Lagna", value: "Leo" }],
      sections: [
        {
          id: "a",
          title: "A Section Title",
          summary: "A sufficiently long section summary for validation.",
          content: "z".repeat(200),
          highlights: [],
        },
      ],
      summary: "y".repeat(120),
      disclaimers: ["A disclaimer long enough to pass."],
    };

    expect(reportDocumentSchema.safeParse(document).success).toBe(false);
    expect(reportDocumentSchema.safeParse({ ...document, schemaVersion: REPORT_SCHEMA_VERSION }).success).toBe(true);
  });

  it("requires at least one calculated fact and one disclaimer", () => {
    const base = reportDocumentSchema.safeParse({
      schemaVersion: REPORT_SCHEMA_VERSION,
      reportType: "CAREER",
      metadata: {
        subjectName: "R",
        generatedAt: new Date().toISOString(),
        astrologyCalculationId: "c",
        calculationVersion: "1",
        ayanamsa: "LAHIRI",
        houseSystem: "WHOLE_SIGN",
        aiProvider: "gemini",
        aiModel: "m",
        promptVersion: PROMPT_VERSION,
      },
      title: "Career Reading",
      introduction: "x".repeat(120),
      calculatedFacts: [],
      sections: [
        { id: "a", title: "A Title", summary: "A sufficiently long summary here.", content: "z".repeat(200), highlights: [] },
      ],
      summary: "y".repeat(120),
      disclaimers: [],
    });

    expect(base.success).toBe(false);
  });
});

describe("development interpretation provider", () => {
  it("labels its output as placeholder so it cannot pass as a real report", async () => {
    const spec = getReportSpec("career")!;
    const { body, provider } = await new DevelopmentInterpretationProvider().generateReportBody({
      systemPrompt: buildSystemPrompt(spec),
      userPrompt: buildUserPrompt(spec, context),
    });

    expect(provider).toBe("development");
    expect(body.introduction.toLowerCase()).toContain("not a real astrological interpretation");
    expect(body.sections.length).toBe(spec.sections.length);
    expect(body.sections.map((section) => section.id)).toEqual(spec.sections.map((section) => section.id));
  });
});
