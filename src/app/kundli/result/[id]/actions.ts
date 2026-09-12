"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearContinuationCookie, consumeContinuation, setContinuationCookie } from "@/lib/auth/continuation";
import { getCurrentUser } from "@/lib/auth/session";
import { buildSignInHref } from "@/lib/auth/return-url";
import { saveKundliToAccount } from "@/lib/account/saved-kundlis";
import { getCurrentTransits } from "@/lib/astrology/tools-service";
import { createTransitChart } from "@/lib/astrology/charts/factory";
import { actorIdentifier, checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import type { VedicChartData } from "@/lib/astrology/charts/types";

import type { SaveKundliState } from "@/lib/shop/action-state";

const calculationIdSchema = z.string().uuid();

/**
 * Step one of save-after-login.
 *
 * Records a signed, HttpOnly continuation cookie proving this browser asked to
 * save this specific calculation, then sends the visitor to sign in. Only the
 * opaque calculation id travels anywhere; no birth data enters the URL.
 */
export async function startKundliSaveAction(_state: SaveKundliState, formData: FormData): Promise<SaveKundliState> {
  const calculationId = calculationIdSchema.safeParse(formData.get("calculationId"));
  if (!calculationId.success) {
    return { error: "That Kundli could not be saved.", saved: false };
  }

  const user = await getCurrentUser();

  if (!user) {
    // Record intent for this exact calculation, then send them to sign in.
    await setContinuationCookie(calculationId.data);
    redirect(buildSignInHref(`/kundli/result/${calculationId.data}`));
  }

  // Already signed in: this request is itself the explicit, authenticated
  // intent, so no continuation round-trip is needed.
  const outcome = await saveKundliToAccount(user.id, calculationId.data);
  if (!outcome.ok) {
    return { error: "That Kundli could not be saved.", saved: false };
  }

  await clearContinuationCookie();
  revalidatePath("/account/kundlis");
  revalidatePath("/account/birth-profiles");

  return { error: null, saved: true };
}

/**
 * Step two of save-after-login.
 *
 * Requires both an authenticated session and a valid continuation for exactly
 * this calculation. Knowing a result URL is never sufficient to claim it.
 */
export async function confirmKundliSaveAction(
  _state: SaveKundliState,
  formData: FormData,
): Promise<SaveKundliState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Your session has expired. Please sign in again.", saved: false };
  }

  const calculationId = calculationIdSchema.safeParse(formData.get("calculationId"));
  if (!calculationId.success) {
    return { error: "That Kundli could not be saved.", saved: false };
  }

  const authorised = await consumeContinuation(calculationId.data);
  if (!authorised) {
    return {
      error: "This Kundli could not be verified for saving. Open the result again and choose Save.",
      saved: false,
    };
  }

  const outcome = await saveKundliToAccount(user.id, calculationId.data);
  if (!outcome.ok) {
    return { error: "That Kundli could not be saved.", saved: false };
  }

  await clearContinuationCookie();
  revalidatePath("/account/kundlis");
  revalidatePath("/account/birth-profiles");

  return { error: null, saved: true };
}

/* ------------------------------------------------------------------ */
/* Gochar for a chosen moment                                          */
/* ------------------------------------------------------------------ */

/**
 * Transits for a date the reader picks.
 *
 * The natal charts on this page come from the stored, immutable calculation and
 * never change. Gochar is the one view that is a function of *when you ask*, so
 * it is computed on demand rather than baked into the saved result - asking for
 * a different date must not rewrite the record of the birth chart.
 *
 * Everything here is deterministic: the same instant always yields the same
 * positions, from the same engine that produced the natal chart.
 */
const gocharRequestSchema = z.object({
  /** Calendar date in the reader's own terms; the time of day is fixed below. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date."),
  /** Which sign the houses are counted from. */
  reference: z.enum(["lagna", "moon"]),
  /** The natal sign to count from, resolved on the page from the calculation. */
  referenceSign: z.number().int().min(1).max(12),
});

export type GocharChartState =
  | { ok: true; chart: VedicChartData; atISO: string }
  | { ok: false; message: string };

/**
 * The window a reader may ask about.
 *
 * Bounded because an unbounded date box is an invitation to probe the ephemeris
 * with absurd inputs, and because a transit chart for the year 9000 is not a
 * question anybody is actually asking.
 */
const EARLIEST_GOCHAR_YEAR = 1900;
const LATEST_GOCHAR_YEAR = 2100;

export async function loadGocharChartAction(input: unknown): Promise<GocharChartState> {
  const decision = await checkRateLimit({
    namespace: "astrology:calculate",
    identifier: await actorIdentifier(),
  });

  if (!decision.allowed) {
    return { ok: false, message: rateLimitMessage(decision.retryAfterSeconds) };
  }

  const parsed = gocharRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "That date could not be read. Pick a date and try again." };
  }

  // Midday keeps the chart away from the boundary where a date rolls over in
  // one timezone but not another, so the day a reader picked is the day they
  // get.
  const at = new Date(`${parsed.data.date}T12:00:00.000Z`);

  if (Number.isNaN(at.getTime())) {
    return { ok: false, message: "That date could not be read. Pick a date and try again." };
  }

  const year = at.getUTCFullYear();
  if (year < EARLIEST_GOCHAR_YEAR || year > LATEST_GOCHAR_YEAR) {
    return {
      ok: false,
      message: `Pick a date between ${EARLIEST_GOCHAR_YEAR} and ${LATEST_GOCHAR_YEAR}.`,
    };
  }

  const outcome = await getCurrentTransits(at);

  if (!outcome.ok) {
    return { ok: false, message: outcome.message };
  }

  return {
    ok: true,
    atISO: outcome.value.at,
    chart: createTransitChart({
      natalAscendantSign: parsed.data.referenceSign,
      transits: outcome.value.positions,
      calculatedAt: outcome.value.at,
    }),
  };
}
