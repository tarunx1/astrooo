import { redactFields } from "@/lib/observability/redact";

/**
 * Structured server-side logging.
 *
 * Production emits one JSON object per line, which is what a log aggregator
 * wants. Development keeps the existing readable shape, because a wall of JSON
 * makes local work harder for no benefit.
 *
 * This adds no dependency: the platform's console is already the transport that
 * every hosting provider collects. Every field passes through redaction, so a
 * caller cannot accidentally log a credential by spreading an object.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = {
  /** Correlates every line emitted while handling one request. */
  requestId?: string;
  route?: string;
  method?: string;
  userId?: string;
  orderId?: string;
  reportId?: string;
  durationMs?: number;
  provider?: string;
  result?: string;
  errorCode?: string;
  [key: string]: unknown;
};

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minimumLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL as LogLevel | undefined;
  if (configured && configured in LEVEL_ORDER) return configured;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function consoleFor(level: LogLevel) {
  if (level === "error") return console.error;
  if (level === "warn") return console.warn;
  return console.info;
}

function emit(level: LogLevel, event: string, fields: LogFields = {}) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minimumLevel()]) return;

  const safe = redactFields(fields);
  const write = consoleFor(level);

  if (process.env.NODE_ENV === "production") {
    write(JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...safe }));
    return;
  }

  write(event, safe);
}

export const logger = {
  debug: (event: string, fields?: LogFields) => emit("debug", event, fields),
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};

/**
 * Reports a failure that an operator needs to see.
 *
 * Deliberately separate from `logger.error` so the high-value failures named in
 * the runbook -- payment, webhook, AI generation, rate-limit store, database --
 * share one event shape and can be alerted on with a single query. An error
 * object is reduced to name and message: a stack trace can carry request data,
 * and it belongs in the error monitor rather than the log line.
 *
 * This is the seam an error-monitoring provider would be attached to. It is
 * intentionally provider-neutral, so adding one later is a change here and
 * nowhere else.
 */
export type IncidentKind =
  | "payment_webhook_failure"
  | "payment_signature_failure"
  | "payment_replay_anomaly"
  | "ai_generation_failure"
  | "rate_limit_store_outage"
  | "database_failure"
  | "admin_transaction_failure"
  | "worker_crash";

export function reportIncident(kind: IncidentKind, fields: LogFields = {}, error?: unknown) {
  const detail =
    error instanceof Error
      ? { errorName: error.name, errorMessage: error.message }
      : error !== undefined
        ? { errorName: "unknown", errorMessage: String(error).slice(0, 200) }
        : {};

  emit("error", "incident", { incident: kind, ...fields, ...detail });
}
