import "server-only";

import { aiReportBodySchema, type AiReportBody } from "@/lib/reports/document";

/**
 * AI interpretation provider.
 *
 * Domain code depends on this interface only. Swapping Gemini for another model
 * is a configuration change, not a refactor. The provider is handed finished
 * prompts and returns a validated report body; it has no knowledge of astrology
 * and performs no calculation.
 */
export type InterpretationRequest = {
  systemPrompt: string;
  userPrompt: string;
  /** Bounds the response so a runaway generation cannot hang a job. */
  maxOutputTokens?: number;
};

export type InterpretationResult = {
  body: AiReportBody;
  model: string;
  provider: string;
};

export interface AIInterpretationProvider {
  readonly name: string;
  readonly model: string;
  generateReportBody(request: InterpretationRequest): Promise<InterpretationResult>;
}

export type AiErrorCategory = "transient" | "invalid_output" | "configuration" | "unknown";

export class AiInterpretationError extends Error {
  readonly category: AiErrorCategory;
  readonly provider: string;

  constructor(message: string, category: AiErrorCategory, provider: string) {
    super(message);
    this.name = "AiInterpretationError";
    this.category = category;
    this.provider = provider;
  }
}

export function isAiInterpretationError(error: unknown): error is AiInterpretationError {
  return error instanceof AiInterpretationError;
}

/** Strips a ```json fence if the model wrapped its output despite instructions. */
function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

export function parseReportBody(raw: string, provider: string): AiReportBody {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new AiInterpretationError("Model output was not valid JSON.", "invalid_output", provider);
  }

  const validated = aiReportBodySchema.safeParse(parsed);
  if (!validated.success) {
    const issue = validated.error.issues[0];
    throw new AiInterpretationError(
      `Model output failed schema validation: ${issue?.path.join(".") ?? "unknown"} ${issue?.message ?? ""}`.trim(),
      "invalid_output",
      provider,
    );
  }

  return validated.data;
}

/**
 * Google Gemini implementation.
 *
 * Called over REST so no vendor SDK is pulled into the server bundle. The API
 * key is read from the server environment and never reaches the browser.
 */
export class GeminiInterpretationProvider implements AIInterpretationProvider {
  readonly name = "gemini";
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: { apiKey: string; model?: string; baseUrl?: string; timeoutMs?: number }) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "gemini-2.5-flash";
    this.baseUrl = options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  async generateReportBody(request: InterpretationRequest): Promise<InterpretationResult> {
    if (!this.apiKey) {
      throw new AiInterpretationError("AI_PROVIDER_API_KEY is not configured.", "configuration", this.name);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/models/${this.model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
            maxOutputTokens: request.maxOutputTokens ?? 16_384,
          },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      throw new AiInterpretationError(
        aborted ? "The interpretation request timed out." : "The interpretation service is unreachable.",
        "transient",
        this.name,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // 429 and 5xx are worth another attempt; 4xx generally is not.
      const category: AiErrorCategory =
        response.status === 429 || response.status >= 500 ? "transient" : "configuration";
      throw new AiInterpretationError(`Interpretation provider returned ${response.status}.`, category, this.name);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    };

    const candidate = payload.candidates?.[0];
    const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

    if (!text.trim()) {
      throw new AiInterpretationError("Interpretation provider returned an empty response.", "transient", this.name);
    }

    if (candidate?.finishReason && candidate.finishReason !== "STOP") {
      throw new AiInterpretationError(
        `Generation stopped early (${candidate.finishReason}).`,
        candidate.finishReason === "MAX_TOKENS" ? "invalid_output" : "transient",
        this.name,
      );
    }

    return { body: parseReportBody(text, this.name), model: this.model, provider: this.name };
  }
}

/**
 * Deterministic local provider.
 *
 * Used only when explicitly selected. It never pretends to be a real
 * interpretation: every section says plainly that it is placeholder text, so a
 * development document can never be mistaken for a purchased report.
 */
export class DevelopmentInterpretationProvider implements AIInterpretationProvider {
  readonly name = "development";
  readonly model = "development-fixture";

  async generateReportBody(request: InterpretationRequest): Promise<InterpretationResult> {
    const sectionIds = [...request.systemPrompt.matchAll(/id "([a-z0-9-]+)"/g)].map((match) => match[1]);
    const titles = [...request.systemPrompt.matchAll(/title "([^"]+)"/g)].map((match) => match[1]);

    const filler =
      "This is development placeholder text and is not a real astrological interpretation. " +
      "It exists so the report pipeline, layout and delivery can be exercised without calling a paid model. " +
      "The calculated chart values shown elsewhere in this document are real; this narrative is not. " +
      "Do not treat any statement here as guidance of any kind.";

    return {
      provider: this.name,
      model: this.model,
      body: aiReportBodySchema.parse({
        title: "Development Placeholder Report",
        introduction: filler,
        summary: filler,
        sections: (sectionIds.length ? sectionIds : ["placeholder"]).map((id, index) => ({
          id,
          title: titles[index] ?? "Placeholder Section",
          summary: "Development placeholder section. Not a real interpretation.",
          content: filler,
          highlights: ["Development fixture", "Not a real interpretation"],
        })),
      }),
    };
  }
}

export function getInterpretationProvider(env: NodeJS.ProcessEnv = process.env): AIInterpretationProvider {
  const configured = env.AI_PROVIDER ?? "gemini";

  if (configured === "development") {
    if (env.NODE_ENV === "production") {
      throw new AiInterpretationError(
        "The development interpretation provider must never be used in production.",
        "configuration",
        "development",
      );
    }
    return new DevelopmentInterpretationProvider();
  }

  if (configured !== "gemini") {
    throw new AiInterpretationError(`Unsupported AI provider "${configured}".`, "configuration", configured);
  }

  return new GeminiInterpretationProvider({
    apiKey: env.AI_PROVIDER_API_KEY ?? "",
    model: env.AI_MODEL ?? "gemini-2.5-flash",
  });
}
