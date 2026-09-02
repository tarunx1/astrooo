export type AstrologyProviderErrorCode = "VALIDATION" | "RATE_LIMITED" | "TIMEOUT" | "UNAVAILABLE" | "CONFIGURATION";

export class AstrologyProviderError extends Error {
  readonly code: AstrologyProviderErrorCode;
  readonly provider: string;
  readonly operation?: string;
  readonly userMessage: string;

  constructor({
    code,
    provider,
    operation,
    message,
    userMessage,
  }: {
    code: AstrologyProviderErrorCode;
    provider: string;
    operation?: string;
    message: string;
    userMessage: string;
  }) {
    super(message);
    this.name = "AstrologyProviderError";
    this.code = code;
    this.provider = provider;
    this.operation = operation;
    this.userMessage = userMessage;
  }
}

export function isAstrologyProviderError(error: unknown): error is AstrologyProviderError {
  return error instanceof AstrologyProviderError;
}
