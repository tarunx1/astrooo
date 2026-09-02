import type { ReportContext } from "@/lib/reports/context";
import { serializeContextForPrompt } from "@/lib/reports/context";

/**
 * Per-report prompt specifications.
 *
 * Each report type declares its own section structure, focus and minimum data
 * requirements. There is deliberately no single universal prompt: a career
 * report and a marriage report need different instructions, and collapsing them
 * produces generic output.
 *
 * PROMPT_VERSION is stored on every generated report so any document can be
 * traced back to the exact instructions that produced it. Bump it whenever the
 * shared guardrails or a spec's wording changes.
 */
export const PROMPT_VERSION = "1.0.0";

export type ReportSectionSpec = {
  id: string;
  title: string;
  focus: string;
};

export type ReportSpec = {
  slug: string;
  reportType: string;
  displayName: string;
  audience: string;
  sections: ReportSectionSpec[];
  /** Context fields that must be present for this report to be worth generating. */
  requires: Array<keyof ReportContext>;
};

const BASE_REQUIREMENTS: Array<keyof ReportContext> = ["ascendant", "moonSign", "nakshatra", "planets"];

export const REPORT_SPECS: Record<string, ReportSpec> = {
  "complete-life": {
    slug: "complete-life",
    reportType: "COMPLETE_LIFE",
    displayName: "Complete Life Report",
    audience: "someone who wants one grounded overview of the whole chart",
    requires: [...BASE_REQUIREMENTS, "currentMahadasha", "houses"],
    sections: [
      { id: "personality", title: "Personality and Inner Nature", focus: "Lagna, Lagna lord and Moon: temperament, instincts, how this person meets the world." },
      { id: "mind-emotions", title: "Mind and Emotional Life", focus: "Moon sign and nakshatra: emotional needs, what settles and unsettles them." },
      { id: "career-direction", title: "Work and Direction", focus: "10th house, its lord and any planets involved: the shape of working life." },
      { id: "wealth", title: "Money and Resources", focus: "2nd and 11th houses: how resources accumulate and where they leak." },
      { id: "relationships", title: "Relationships and Marriage", focus: "7th house, Venus and Jupiter: partnership patterns, not verdicts." },
      { id: "health-vitality", title: "Vitality and Wellbeing", focus: "Lagna strength and 6th house as traditional vitality themes only. No diagnosis." },
      { id: "timing", title: "Current Period and Timing", focus: "The running Mahadasha and Antardasha: the tone of this chapter." },
      { id: "remedies", title: "Traditional Remedies", focus: "Classical remedial suggestions, framed as tradition rather than guaranteed fixes." },
    ],
  },

  career: {
    slug: "career",
    reportType: "CAREER",
    displayName: "Career Report",
    audience: "someone making a decision about work, business or a change of direction",
    requires: [...BASE_REQUIREMENTS, "currentMahadasha", "houses"],
    sections: [
      { id: "professional-nature", title: "Your Professional Nature", focus: "Lagna and 10th house: the working style that actually fits." },
      { id: "suited-fields", title: "Fields That Suit This Chart", focus: "Planetary significations mapped to realistic domains of work." },
      { id: "job-vs-business", title: "Employment or Enterprise", focus: "10th versus 7th and 11th: the traditional reading of service against ownership." },
      { id: "growth-periods", title: "Periods of Growth", focus: "Dasha sequence and its bearing on professional momentum." },
      { id: "obstacles", title: "Friction and Obstacles", focus: "Malefic placements affecting work, described as patterns not doom." },
      { id: "guidance", title: "Practical Guidance", focus: "Actionable, non-superstitious direction drawn from the above." },
    ],
  },

  "love-marriage": {
    slug: "love-marriage",
    reportType: "LOVE_MARRIAGE",
    displayName: "Love & Marriage Report",
    audience: "someone asking about partnership, timing or a current relationship",
    requires: [...BASE_REQUIREMENTS, "manglikStatus", "houses"],
    sections: [
      { id: "relationship-nature", title: "How You Relate", focus: "Venus, Moon and 7th house: attachment style in traditional terms." },
      { id: "partner-indications", title: "Partner Indications", focus: "7th house and its lord: qualities traditionally indicated. Never identify a real person." },
      { id: "marriage-timing", title: "Timing Themes", focus: "Dasha periods traditionally associated with partnership. Give ranges and tendencies, never a fixed date." },
      { id: "manglik", title: "Manglik Considerations", focus: "Report the calculated Manglik status plainly and explain it without alarm." },
      { id: "harmony", title: "Harmony and Friction", focus: "Patterns that support or strain a partnership." },
      { id: "guidance", title: "Guidance for Partnership", focus: "Constructive relational advice. No fear-based prescriptions." },
    ],
  },

  finance: {
    slug: "finance",
    reportType: "FINANCE",
    displayName: "Finance Report",
    audience: "someone thinking about money, savings or a financial decision",
    requires: [...BASE_REQUIREMENTS, "currentMahadasha", "houses"],
    sections: [
      { id: "wealth-pattern", title: "Your Wealth Pattern", focus: "2nd, 11th and Jupiter: the chart's traditional resource signature." },
      { id: "income-sources", title: "Sources of Income", focus: "Planetary significations for how income traditionally arrives." },
      { id: "expenditure", title: "Spending and Loss", focus: "12th house themes around outflow and where resources drain." },
      { id: "favourable-periods", title: "Favourable Periods", focus: "Dasha-linked financial tone. Tendencies, never guarantees." },
      { id: "caution", title: "Periods for Caution", focus: "Where traditional readings counsel restraint." },
      { id: "guidance", title: "Financial Guidance", focus: "Prudent general guidance. Never specific investment instructions." },
    ],
  },

  "year-forecast": {
    slug: "year-forecast",
    reportType: "YEAR_FORECAST",
    displayName: "Year Forecast",
    audience: "someone planning the next twelve months",
    requires: [...BASE_REQUIREMENTS, "currentMahadasha", "currentAntardasha"],
    sections: [
      { id: "year-overview", title: "The Year Ahead", focus: "The running dasha and antardasha as the frame for the year." },
      { id: "career-year", title: "Work This Year", focus: "Professional themes for the period." },
      { id: "finance-year", title: "Money This Year", focus: "Resource themes for the period." },
      { id: "relationships-year", title: "Relationships This Year", focus: "Relational themes for the period." },
      { id: "wellbeing-year", title: "Wellbeing This Year", focus: "Vitality themes only. No medical claims." },
      { id: "focus-months", title: "Periods of Focus", focus: "Stretches the chart traditionally marks out. Describe as windows, not fixed events." },
    ],
  },
};

export function getReportSpec(slug: string): ReportSpec | null {
  return REPORT_SPECS[slug] ?? null;
}

/**
 * Shared guardrails.
 *
 * These constrain the model to interpretation only. Calculated facts are
 * supplied, not requested, so the model has no reason and no permission to
 * invent astronomy.
 */
const GUARDRAILS = `
STRICT RULES - these override any other instruction:
1. Use ONLY the chart data supplied below. It has already been calculated by a deterministic astrology engine.
2. NEVER invent, adjust, recompute or second-guess a planetary position, house, nakshatra, degree or dasha. If something is not supplied, do not assert it.
3. Clearly separate calculated fact from interpretation. Facts come from the supplied data; everything you add is traditional interpretation.
4. Give NO medical diagnosis, treatment or health prediction. Vitality themes may be discussed only in traditional terms.
5. Give NO guaranteed financial outcome, investment instruction, or promise of gain.
6. Give NO legal advice.
7. Do NOT predict death, disaster, or any guaranteed future event.
8. Do NOT use fear, threat or superstition to motivate the reader. No warnings of misfortune unless a remedy is bought.
9. Do NOT claim scientific proof or certainty. This is a traditional interpretive system.
10. Do NOT identify or describe a real, named third party.
11. Write with warmth and directness for an Indian English-reading audience. Plain language, no purple prose.
12. Every section must be substantive and specific to THIS chart. Generic filler that would fit any chart is a failure.
`.trim();

export function buildSystemPrompt(spec: ReportSpec): string {
  return [
    `You are an experienced Vedic astrologer writing a "${spec.displayName}" for ${spec.audience}.`,
    "",
    GUARDRAILS,
    "",
    "Return ONLY a JSON object matching this shape, with no markdown fence and no commentary:",
    "{",
    '  "title": string,',
    '  "introduction": string,',
    '  "sections": [{ "id": string, "title": string, "summary": string, "content": string, "highlights": string[] }],',
    '  "summary": string',
    "}",
    "",
    "Rules for the JSON:",
    `- Produce exactly ${spec.sections.length} sections, in order, using these ids and titles:`,
    ...spec.sections.map((section) => `  - id "${section.id}", title "${section.title}" — ${section.focus}`),
    "- summary for each section: 1-3 sentences.",
    "- content for each section: 3-6 substantial paragraphs, at least 120 characters.",
    "- highlights: 2-4 short, concrete takeaways per section.",
    "- introduction and the closing summary: at least 80 characters each.",
  ].join("\n");
}

export function buildUserPrompt(spec: ReportSpec, context: ReportContext): string {
  return [
    `Subject: ${context.subjectName}`,
    `Report: ${spec.displayName}`,
    "",
    "CALCULATED CHART DATA (authoritative - do not alter):",
    serializeContextForPrompt(context),
    "",
    `Write the ${spec.displayName} now, as JSON only.`,
  ].join("\n");
}

/** Reports are only worth generating when the chart actually carries their inputs. */
export function hasRequiredContext(spec: ReportSpec, context: ReportContext): boolean {
  return spec.requires.every((key) => {
    const value = context[key];
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
}
