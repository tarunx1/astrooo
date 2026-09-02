import { z } from "zod";
import { vedAstroConfig } from "@/config/astrology";
import { AstrologyProviderError } from "@/lib/astrology/errors";

const vedAstroEnvelopeSchema = z.object({
  Status: z.enum(["Pass", "Fail"]),
  Payload: z.unknown(),
});

export type VedAstroClientConfig = {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  retryCount?: number;
  fetchImpl?: typeof fetch;
};

export class VedAstroClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly retryCount: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: VedAstroClientConfig = {}) {
    this.baseUrl = (config.baseUrl ?? vedAstroConfig.baseUrl).replace(/\/$/, "");
    this.apiKey = config.apiKey ?? vedAstroConfig.apiKey;
    this.timeoutMs = config.timeoutMs ?? vedAstroConfig.timeoutMs;
    this.retryCount = config.retryCount ?? vedAstroConfig.retryCount;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async calculate(method: string, body: unknown) {
    const startedAt = Date.now();
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retryCount; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(`${this.baseUrl}/Calculate/${method}`, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const raw = await response.json().catch(() => null);

        if (response.status === 429) {
          throw new AstrologyProviderError({
            code: "RATE_LIMITED",
            provider: "vedastro",
            operation: method,
            message: "VedAstro rate limit reached.",
            userMessage: "The Kundli calculation service is busy. Please try again in a minute.",
          });
        }
        if (response.status >= 500 && attempt < this.retryCount) continue;
        if (!response.ok) {
          throw new AstrologyProviderError({
            code: "UNAVAILABLE",
            provider: "vedastro",
            operation: method,
            message: `VedAstro returned HTTP ${response.status}.`,
            userMessage: "The Kundli calculation service is temporarily unavailable. Please try again.",
          });
        }

        const envelope = vedAstroEnvelopeSchema.safeParse(raw);
        if (!envelope.success) {
          throw new AstrologyProviderError({
            code: "UNAVAILABLE",
            provider: "vedastro",
            operation: method,
            message: "VedAstro response envelope did not match the documented format.",
            userMessage: "The Kundli calculation service returned an unexpected response. Please try again.",
          });
        }
        if (envelope.data.Status === "Fail") {
          throw new AstrologyProviderError({
            code: "VALIDATION",
            provider: "vedastro",
            operation: method,
            message: typeof envelope.data.Payload === "string" ? envelope.data.Payload : "VedAstro returned Status: Fail.",
            userMessage: "The birth details could not be calculated by the astrology provider. Please check the details and try again.",
          });
        }

        logVedAstroRequest({ operation: method, latencyMs: Date.now() - startedAt, success: true });
        return unwrapVedAstroPayload(method, envelope.data.Payload);
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        if (error instanceof AstrologyProviderError) throw error;
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new AstrologyProviderError({
            code: "TIMEOUT",
            provider: "vedastro",
            operation: method,
            message: "VedAstro request timed out.",
            userMessage: "The Kundli calculation service timed out. Please try again.",
          });
        }
        if (attempt >= this.retryCount) break;
      } finally {
        clearTimeout(timeout);
      }
    }

    logVedAstroRequest({ operation: method, latencyMs: Date.now() - startedAt, success: false });
    throw new AstrologyProviderError({
      code: "UNAVAILABLE",
      provider: "vedastro",
      operation: method,
      message: lastError instanceof Error ? lastError.message : "VedAstro request failed.",
      userMessage: "The Kundli calculation service is temporarily unavailable. Please try again.",
    });
  }

  private headers() {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;
    return headers;
  }
}

export function unwrapVedAstroPayload(method: string, payload: unknown) {
  if (payload && typeof payload === "object" && !Array.isArray(payload) && method in payload) {
    return (payload as Record<string, unknown>)[method];
  }
  return payload;
}

function logVedAstroRequest(input: { operation: string; latencyMs: number; success: boolean }) {
  console.info("astrology_provider_request", {
    provider: "vedastro",
    operation: input.operation,
    latencyMs: input.latencyMs,
    cache: "miss",
    success: input.success,
  });
}
