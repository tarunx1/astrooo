"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearContinuationCookie, consumeContinuation, setContinuationCookie } from "@/lib/auth/continuation";
import { getCurrentUser } from "@/lib/auth/session";
import { buildSignInHref } from "@/lib/auth/return-url";
import { saveKundliToAccount } from "@/lib/account/saved-kundlis";

export type SaveKundliState = {
  error: string | null;
  saved: boolean;
};

export const INITIAL_SAVE_STATE: SaveKundliState = { error: null, saved: false };

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
