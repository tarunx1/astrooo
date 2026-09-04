"use server";

import { z } from "zod";
import { getBirthInsight, getCompatibility, getPanchang, getSadeSati } from "@/lib/astrology/tools-service";
import { resolveBirthFromForm } from "@/lib/astrology/tool-input";
import { getLocationProvider } from "@/lib/location/provider";
import { actorIdentifier, checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import { calculateNumerology, NumerologyCalculationError } from "@/lib/numerology/calculator";
import type {
  BirthToolState,
  CompatibilityState,
  NumerologyState,
  PanchangState,
  SadeSatiState,
} from "@/lib/astrology/tool-action-state";

/**
 * Tool server actions.
 *
 * Every result is computed by deterministic code — the astrology provider or the
 * numerology calculator. No model is consulted, and birth details never leave
 * the request: results are returned in action state rather than encoded into a
 * URL.
 */
/**
 * Astrology tools call an external provider whose free tier allows only a few
 * requests a minute, so an unmetered calculator would exhaust the quota for
 * every visitor at once.
 */
async function astrologyRateLimit(): Promise<string | null> {
  const decision = await checkRateLimit({
    namespace: "astrology:calculate",
    identifier: await actorIdentifier(),
  });
  return decision.allowed ? null : rateLimitMessage(decision.retryAfterSeconds);
}

export async function calculateBirthToolAction(_state: BirthToolState, formData: FormData): Promise<BirthToolState> {
  const blocked = await astrologyRateLimit();
  if (blocked) return { formErrors: [blocked], fieldErrors: {}, result: null };

  const birth = await resolveBirthFromForm(formData);
  if (!birth.ok) return { formErrors: birth.formErrors, fieldErrors: birth.fieldErrors, result: null };

  const outcome = await getBirthInsight(birth.value);
  if (!outcome.ok) return { formErrors: [outcome.message], fieldErrors: {}, result: null };

  return { formErrors: [], fieldErrors: {}, result: outcome.value };
}

export async function calculateSadeSatiAction(_state: SadeSatiState, formData: FormData): Promise<SadeSatiState> {
  const blocked = await astrologyRateLimit();
  if (blocked) return { formErrors: [blocked], fieldErrors: {}, result: null };

  const birth = await resolveBirthFromForm(formData);
  if (!birth.ok) return { formErrors: birth.formErrors, fieldErrors: birth.fieldErrors, result: null };

  const outcome = await getSadeSati(birth.value);
  if (!outcome.ok) return { formErrors: [outcome.message], fieldErrors: {}, result: null };

  return { formErrors: [], fieldErrors: {}, result: outcome.value };
}

export async function calculateCompatibilityAction(
  _state: CompatibilityState,
  formData: FormData,
): Promise<CompatibilityState> {
  const blocked = await astrologyRateLimit();
  if (blocked) return { formErrors: [blocked], fieldErrors: {}, result: null };

  const [personA, personB] = await Promise.all([
    resolveBirthFromForm(formData, "a"),
    resolveBirthFromForm(formData, "b"),
  ]);

  if (!personA.ok || !personB.ok) {
    return {
      formErrors: [...(personA.ok ? [] : personA.formErrors), ...(personB.ok ? [] : personB.formErrors)],
      fieldErrors: { ...(personA.ok ? {} : personA.fieldErrors), ...(personB.ok ? {} : personB.fieldErrors) },
      result: null,
    };
  }

  const outcome = await getCompatibility(personA.value, personB.value);
  if (!outcome.ok) return { formErrors: [outcome.message], fieldErrors: {}, result: null };

  return { formErrors: [], fieldErrors: {}, result: outcome.value };
}

const panchangSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
  placeId: z.string().trim().min(1, "Select a place from the suggestions."),
});

export async function calculatePanchangAction(_state: PanchangState, formData: FormData): Promise<PanchangState> {
  const blocked = await astrologyRateLimit();
  if (blocked) return { formErrors: [blocked], fieldErrors: {}, result: null };

  const parsed = panchangSchema.safeParse({
    date: formData.get("date"),
    placeId: formData.get("placeId"),
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return { formErrors: flattened.formErrors, fieldErrors: flattened.fieldErrors, result: null };
  }

  const location = await getLocationProvider().resolve(parsed.data.placeId);
  if (!location) {
    return { formErrors: [], fieldErrors: { placeId: ["Select a place from the suggestions."] }, result: null };
  }

  const outcome = await getPanchang({ date: parsed.data.date, location });
  if (!outcome.ok) return { formErrors: [outcome.message], fieldErrors: {}, result: null };

  return { formErrors: [], fieldErrors: {}, result: outcome.value };
}

const numerologySchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date of birth."),
  name: z.string().trim().max(120).optional(),
});

export async function calculateNumerologyAction(
  _state: NumerologyState,
  formData: FormData,
): Promise<NumerologyState> {
  const parsed = numerologySchema.safeParse({
    dateOfBirth: formData.get("dateOfBirth"),
    name: formData.get("name") ?? "",
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return { formErrors: flattened.formErrors, fieldErrors: flattened.fieldErrors, result: null };
  }

  try {
    return {
      formErrors: [],
      fieldErrors: {},
      result: calculateNumerology({ dateOfBirth: parsed.data.dateOfBirth, name: parsed.data.name ?? null }),
    };
  } catch (error) {
    const message = error instanceof NumerologyCalculationError ? error.message : "That date could not be calculated.";
    return { formErrors: [], fieldErrors: { dateOfBirth: [message] }, result: null };
  }
}
