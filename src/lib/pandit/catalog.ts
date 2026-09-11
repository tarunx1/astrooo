import { ConsultationMode, PanditDocumentType, RateType } from "@prisma/client";

/**
 * Closed vocabularies for Pandit profiles.
 *
 * Specialisations and languages are picked from a list rather than typed free
 * form, so the customer-facing filters mean something: "KP Astrology" and "K.P.
 * astrology" typed by two Pandits would otherwise be two different facets that
 * no search could reconcile.
 */
export const EXPERTISE_OPTIONS = [
  "Vedic Astrology",
  "KP Astrology",
  "Numerology",
  "Kundli Reading",
  "Kundli Matching",
  "Marriage",
  "Career",
  "Finance",
  "Health",
  "Education",
  "Gemstones",
  "Muhurat",
  "Vastu",
  "Palmistry",
  "Prashna",
  "Remedies",
] as const;

export type Expertise = (typeof EXPERTISE_OPTIONS)[number];

export function isExpertise(value: unknown): value is Expertise {
  return typeof value === "string" && (EXPERTISE_OPTIONS as readonly string[]).includes(value);
}

export const LANGUAGE_OPTIONS = [
  "Hindi",
  "English",
  "Punjabi",
  "Bengali",
  "Marathi",
  "Gujarati",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Odia",
  "Assamese",
  "Urdu",
  "Sanskrit",
  "Nepali",
] as const;

export type Language = (typeof LANGUAGE_OPTIONS)[number];

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGE_OPTIONS as readonly string[]).includes(value);
}

export const MODE_LABEL: Readonly<Record<ConsultationMode, string>> = {
  [ConsultationMode.CHAT]: "Chat",
  [ConsultationMode.VOICE_CALL]: "Voice call",
  [ConsultationMode.VIDEO_CALL]: "Video call",
};

export const RATE_TYPE_LABEL: Readonly<Record<RateType, string>> = {
  [RateType.PER_MINUTE]: "Per minute",
  [RateType.FIXED_SESSION]: "Fixed session",
};

export const DOCUMENT_TYPE_LABEL: Readonly<Record<PanditDocumentType, string>> = {
  [PanditDocumentType.IDENTITY]: "Identity document",
  [PanditDocumentType.ADDRESS]: "Address proof",
  [PanditDocumentType.CERTIFICATE]: "Professional certificate",
  [PanditDocumentType.EXPERIENCE]: "Experience proof",
  [PanditDocumentType.OTHER]: "Supporting document",
};

/**
 * Documents an application cannot be submitted without.
 *
 * Kept short deliberately: a certificate is meaningful evidence for some
 * practitioners and meaningless for others, so requiring one would filter for
 * paperwork rather than for practice. Identity is the one thing verification
 * genuinely depends on.
 */
export const REQUIRED_DOCUMENT_TYPES: readonly PanditDocumentType[] = [PanditDocumentType.IDENTITY];

/** Upload constraints, enforced server-side on every upload. */
export const DOCUMENT_MAX_BYTES = 8 * 1024 * 1024;

export const DOCUMENT_ALLOWED_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Minutes-from-midnight rendered as a 24-hour clock face. */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** Parses "HH:MM" into minutes from midnight, or null when it is not a clock time. */
export function parseMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * The granularity of a bookable slot.
 *
 * One value, used by both the availability generator and the booking validator,
 * so a slot a customer is offered is always a slot the booker will accept.
 */
export const SLOT_GRANULARITY_MINUTES = 15;

/** Session lengths a customer may choose. */
export const BOOKABLE_DURATIONS_MINUTES: readonly number[] = [15, 30, 45, 60];
