"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createBirthProfile,
  deleteOwnedBirthProfile,
  getOwnedBirthProfile,
  resolveBirthDetails,
  updateOwnedBirthProfile,
} from "@/lib/account/birth-profiles";
import { generateKundliForOwnedProfile } from "@/lib/account/profile-kundli";
import { getCurrentUser } from "@/lib/auth/session";
import type { BirthDetailsInput } from "@/lib/kundli/schema";

/**
 * Server Actions are public endpoints. Each one below therefore runs the same
 * four steps in order: authenticate from the session, validate the payload with
 * Zod, authorize by ownership, then execute. No action accepts a userId from
 * the browser.
 */
export type AccountFormState = {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
};

const EMPTY_STATE: AccountFormState = { formErrors: [], fieldErrors: {} };

const UNAUTHENTICATED: AccountFormState = {
  formErrors: ["Your session has expired. Please sign in again."],
  fieldErrors: {},
};

const NOT_FOUND: AccountFormState = {
  formErrors: ["That birth profile is not available."],
  fieldErrors: {},
};

const profileIdSchema = z.string().min(1).max(64);

export async function createBirthProfileAction(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHENTICATED;

  const resolution = await resolveBirthDetails(Object.fromEntries(formData.entries()) as BirthDetailsInput);
  if (!resolution.ok) {
    return { formErrors: resolution.formErrors, fieldErrors: resolution.fieldErrors };
  }

  await createBirthProfile(user.id, resolution.normalized);

  revalidatePath("/account/birth-profiles");
  redirect("/account/birth-profiles");
}

export async function updateBirthProfileAction(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHENTICATED;

  const profileId = profileIdSchema.safeParse(formData.get("profileId"));
  if (!profileId.success) return NOT_FOUND;

  // Authorize before doing any work: an unowned id must behave as "not found".
  const owned = await getOwnedBirthProfile(user.id, profileId.data);
  if (!owned) return NOT_FOUND;

  const resolution = await resolveBirthDetails(Object.fromEntries(formData.entries()) as BirthDetailsInput);
  if (!resolution.ok) {
    return { formErrors: resolution.formErrors, fieldErrors: resolution.fieldErrors };
  }

  const updated = await updateOwnedBirthProfile(user.id, profileId.data, resolution.normalized);
  if (!updated) return NOT_FOUND;

  revalidatePath("/account/birth-profiles");
  redirect("/account/birth-profiles");
}

export async function deleteBirthProfileAction(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHENTICATED;

  const profileId = profileIdSchema.safeParse(formData.get("profileId"));
  if (!profileId.success) return NOT_FOUND;

  const confirmed = formData.get("confirm") === "delete";
  if (!confirmed) {
    return { formErrors: ["Deletion was not confirmed."], fieldErrors: {} };
  }

  const deleted = await deleteOwnedBirthProfile(user.id, profileId.data);
  if (!deleted) return NOT_FOUND;

  revalidatePath("/account/birth-profiles");
  revalidatePath("/account/kundlis");
  return EMPTY_STATE;
}

/**
 * Generates or reuses the Kundli for a profile the user owns, then sends them to
 * the result. Ownership is checked inside the query, so another user's profile
 * id simply resolves to "not found".
 */
export async function viewProfileKundliAction(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHENTICATED;

  const profileId = profileIdSchema.safeParse(formData.get("profileId"));
  if (!profileId.success) return NOT_FOUND;

  const outcome = await generateKundliForOwnedProfile(user.id, profileId.data);
  if (!outcome.ok) {
    if (outcome.reason === "not_found") return NOT_FOUND;
    return { formErrors: [outcome.message ?? "The Kundli could not be generated."], fieldErrors: {} };
  }

  redirect(`/kundli/result/${outcome.calculationId}`);
}
