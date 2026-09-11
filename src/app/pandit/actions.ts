"use server";

import { revalidatePath } from "next/cache";
import {
  ConsultationMode,
  ConsultationStatus,
  PanditDocumentType,
  PanditOnboardingStatus,
  RateType,
  UserRole,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getViewer } from "@/lib/auth/access";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import {
  PanditServiceError,
  applyTransition,
  basicDetailsSchema,
  canSubmitApplication,
  getCompletion,
  professionalProfileSchema,
  saveOwnService,
  startPanditApplication,
  updateOwnProfile,
} from "@/lib/pandit/service";
import { DocumentError, deleteOwnDocument, uploadOwnDocument } from "@/lib/pandit/documents";
import {
  ScheduleError,
  addScheduleRule,
  removeScheduleException,
  removeScheduleRule,
  saveScheduleException,
  scheduleExceptionSchema,
  scheduleRuleSchema,
} from "@/lib/pandit/schedule";
import { PayoutAccountError, payoutAccountSchema, saveOwnPayoutAccount } from "@/lib/payouts/account";
import { settleConsultation } from "@/lib/payouts/ledger";
import { createTicket, replyToTicket, ticketInputSchema } from "@/lib/support/tickets";
import { parseMinutes } from "@/lib/pandit/catalog";
import { isApprovedOrLater, isEditableByPandit } from "@/lib/pandit/onboarding";
import type { AdminActionState } from "@/lib/admin/action-state";
import type { RateLimitNamespace } from "@/lib/security/rate-limit";

/**
 * Pandit self-service Server Actions.
 *
 * Authorization here is ownership rather than permission: there is no
 * "edit any Pandit" capability to hold, and every action resolves the acting
 * Pandit's own profile from the session user id. No action takes a profile id
 * from the form, so there is no shape of request that writes to somebody else's
 * account - the question "is this mine?" is never asked because the alternative
 * is never expressible.
 *
 * Nothing here can advance verification. The only transitions these actions
 * request are the ones the declared table gives the "pandit" actor, and
 * `applyTransition` checks that independently.
 */
function denied(reason?: string): AdminActionState {
  return { ok: false, error: reason ?? "You are not authorised to perform this action.", fieldErrors: {} };
}

function failure(
  error: string,
  fieldErrors: Record<string, string[]> = {},
  formData?: FormData,
): AdminActionState {
  const values: Record<string, string> = {};
  if (formData) {
    for (const [name, value] of formData.entries()) {
      if (typeof value === "string") values[name] = value;
    }
  }
  return { ok: false, error, fieldErrors, values: formData ? values : undefined };
}

function success(message: string): AdminActionState {
  return { ok: true, error: null, message, fieldErrors: {} };
}

type PanditActor = {
  userId: string;
  profileId: string;
  status: PanditOnboardingStatus;
};

/**
 * Resolves the acting Pandit and applies the rate limit.
 *
 * One helper so no action can be written that forgets either. `requireApproved`
 * is how the pre-approval dashboard stays small: the consultation toolset is
 * refused here, on the server, not merely hidden from the navigation.
 */
async function actingPandit(options?: {
  requireApproved?: boolean;
  requireEditable?: boolean;
  namespace?: RateLimitNamespace;
}): Promise<{ ok: true; actor: PanditActor } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== UserRole.PANDIT || !viewer.panditProfileId) {
    return { ok: false, error: "You are not authorised to perform this action." };
  }

  const profile = await prisma.panditProfile.findUnique({
    where: { id: viewer.panditProfileId },
    select: { id: true, userId: true, status: true },
  });

  if (!profile || profile.userId !== viewer.id) {
    return { ok: false, error: "You are not authorised to perform this action." };
  }

  if (options?.requireApproved && !isApprovedOrLater(profile.status)) {
    return { ok: false, error: "This becomes available once your application is approved." };
  }

  if (options?.requireEditable && !isEditableByPandit(profile.status)) {
    return { ok: false, error: "Your application is with a reviewer and cannot be edited right now." };
  }

  const decision = await checkRateLimit({
    namespace: options?.namespace ?? "pandit:mutation",
    identifier: `user:${viewer.id}`,
  });

  if (!decision.allowed) return { ok: false, error: rateLimitMessage(decision.retryAfterSeconds) };

  return { ok: true, actor: { userId: viewer.id, profileId: profile.id, status: profile.status } };
}

function revalidatePandit(): void {
  revalidatePath("/pandit");
  revalidatePath("/pandit/onboarding");
  revalidatePath("/pandit/verification");
  revalidatePath("/pandit/profile");
}

/* ------------------------------------------------------------------ */
/* Applying                                                            */
/* ------------------------------------------------------------------ */

/**
 * Opens a Pandit application for the signed-in account.
 *
 * Reachable by any signed-in customer, which is safe because an application at
 * REQUESTED grants nothing: the role change it makes carries no permissions,
 * and being listed, bookable or paid all depend on the onboarding status, which
 * only a reviewer can advance.
 */
export async function applyAsPanditAction(
  _state: AdminActionState,
  _formData: FormData,
): Promise<AdminActionState> {
  const viewer = await getViewer();
  if (!viewer) return denied("Sign in first.");

  const decision = await checkRateLimit({
    namespace: "pandit:mutation",
    identifier: `user:${viewer.id}`,
  });
  if (!decision.allowed) return failure(rateLimitMessage(decision.retryAfterSeconds));

  try {
    await startPanditApplication(viewer.id);
  } catch (error) {
    if (error instanceof PanditServiceError) return failure(error.message);
    throw error;
  }

  revalidatePandit();
  revalidatePath("/account");
  return success("Your application is open. Complete your details to continue.");
}

export async function saveBasicDetailsAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await actingPandit({ requireEditable: true });
  if (!auth.ok) return denied(auth.error);

  const parsed = basicDetailsSchema.safeParse({
    displayName: formData.get("displayName"),
    phone: formData.get("phone"),
    city: formData.get("city"),
    state: formData.get("state"),
    country: (formData.get("country") as string) || "IN",
    timezone: (formData.get("timezone") as string) || "Asia/Kolkata",
    yearsOfExperience: Number(formData.get("yearsOfExperience")),
  });

  if (!parsed.success) {
    return failure("Check the details below.", z.flattenError(parsed.error).fieldErrors, formData);
  }

  const expertise = formData.getAll("expertise").filter((v): v is string => typeof v === "string");
  const languages = formData.getAll("languages").filter((v): v is string => typeof v === "string");

  if (expertise.length === 0) return failure("Pick at least one specialisation.", {}, formData);
  if (languages.length === 0) return failure("Pick at least one language.", {}, formData);

  const listsParsed = professionalProfileSchema
    .pick({ expertise: true, languages: true })
    .safeParse({ expertise, languages });

  if (!listsParsed.success) return failure("That specialisation or language is not recognised.", {}, formData);

  try {
    await updateOwnProfile(auth.actor.userId, { ...parsed.data, ...listsParsed.data });
  } catch (error) {
    if (error instanceof PanditServiceError) return failure(error.message, {}, formData);
    throw error;
  }

  // First save moves the application forward; later saves leave it where it is.
  if (auth.actor.status === PanditOnboardingStatus.REQUESTED) {
    await applyTransition({
      panditProfileId: auth.actor.profileId,
      to: PanditOnboardingStatus.PROFILE_STARTED,
      actorUserId: auth.actor.userId,
      actorKind: "pandit",
    });
  }

  if (auth.actor.status === PanditOnboardingStatus.PROFILE_STARTED) {
    await applyTransition({
      panditProfileId: auth.actor.profileId,
      to: PanditOnboardingStatus.DOCUMENTS_PENDING,
      actorUserId: auth.actor.userId,
      actorKind: "pandit",
    });
  }

  revalidatePandit();
  return success("Details saved.");
}

export async function uploadDocumentAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await actingPandit({ requireEditable: true, namespace: "pandit:document-upload" });
  if (!auth.ok) return denied(auth.error);

  const type = formData.get("type");
  const file = formData.get("file");

  if (typeof type !== "string" || !(type in PanditDocumentType)) {
    return failure("Pick a document type.");
  }
  if (!(file instanceof File) || file.size === 0) {
    return failure("Choose a file to upload.");
  }

  try {
    await uploadOwnDocument({
      userId: auth.actor.userId,
      type: type as PanditDocumentType,
      file,
      note: (formData.get("note") as string) || null,
    });
  } catch (error) {
    if (error instanceof DocumentError) return failure(error.message);
    throw error;
  }

  // Reaching DOCUMENTS_PENDING from PROFILE_STARTED is legal and idempotent;
  // when already further along the transition is simply refused and ignored.
  if (auth.actor.status === PanditOnboardingStatus.PROFILE_STARTED) {
    await applyTransition({
      panditProfileId: auth.actor.profileId,
      to: PanditOnboardingStatus.DOCUMENTS_PENDING,
      actorUserId: auth.actor.userId,
      actorKind: "pandit",
    });
  }

  revalidatePandit();
  return success("Document uploaded.");
}

export async function deleteDocumentAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await actingPandit({ requireEditable: true });
  if (!auth.ok) return denied(auth.error);

  const documentId = formData.get("documentId");
  if (typeof documentId !== "string") return failure("That document is not recognised.");

  try {
    await deleteOwnDocument(auth.actor.userId, documentId);
  } catch (error) {
    if (error instanceof DocumentError) return failure(error.message);
    throw error;
  }

  revalidatePandit();
  return success("Document removed.");
}

/**
 * Submits the application for review.
 *
 * Completeness is checked against the database, not against the form, so a
 * crafted request cannot put an empty application into a reviewer's queue.
 */
export async function submitApplicationAction(
  _state: AdminActionState,
  _formData: FormData,
): Promise<AdminActionState> {
  const auth = await actingPandit({ requireEditable: true });
  if (!auth.ok) return denied(auth.error);

  const readiness = await canSubmitApplication(auth.actor.profileId);
  if (!readiness.ok) {
    return failure(`Still needed before you can submit: ${readiness.missing.join(", ")}.`);
  }

  const result = await applyTransition({
    panditProfileId: auth.actor.profileId,
    to: PanditOnboardingStatus.SUBMITTED,
    actorUserId: auth.actor.userId,
    actorKind: "pandit",
  });

  if (!result.ok) return failure(result.message);

  revalidatePandit();
  revalidatePath("/admin/pandits/applications");
  revalidatePath("/employee/pandits");
  return success("Submitted. A reviewer will look at it shortly.");
}

/* ------------------------------------------------------------------ */
/* Professional profile                                                */
/* ------------------------------------------------------------------ */

export async function saveProfessionalProfileAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await actingPandit({ requireApproved: true });
  if (!auth.ok) return denied(auth.error);

  const parsed = professionalProfileSchema.safeParse({
    displayName: formData.get("displayName"),
    headline: (formData.get("headline") as string)?.trim() || null,
    bio: formData.get("bio"),
    profileImageUrl: (formData.get("profileImageUrl") as string)?.trim() || null,
    languages: formData.getAll("languages").filter((v): v is string => typeof v === "string"),
    expertise: formData.getAll("expertise").filter((v): v is string => typeof v === "string"),
    certifications: formData
      .getAll("certifications")
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0),
    yearsOfExperience: Number(formData.get("yearsOfExperience")),
    city: formData.get("city"),
    state: formData.get("state"),
  });

  if (!parsed.success) {
    return failure("Check the details below.", z.flattenError(parsed.error).fieldErrors, formData);
  }

  try {
    await updateOwnProfile(auth.actor.userId, parsed.data);
  } catch (error) {
    if (error instanceof PanditServiceError) return failure(error.message, {}, formData);
    throw error;
  }

  // Approval is the platform's decision; completing the profile is the step
  // that takes the Pandit from approved to listable.
  if (auth.actor.status === PanditOnboardingStatus.APPROVED) {
    await applyTransition({
      panditProfileId: auth.actor.profileId,
      to: PanditOnboardingStatus.PROFILE_COMPLETION_REQUIRED,
      actorUserId: auth.actor.userId,
      actorKind: "pandit",
    });
  }

  revalidatePandit();
  return success("Profile saved.");
}

export async function saveServiceAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await actingPandit({ requireApproved: true });
  if (!auth.ok) return denied(auth.error);

  const rupees = Number(formData.get("rate"));
  const parsed = z
    .object({
      mode: z.nativeEnum(ConsultationMode),
      enabled: z.boolean(),
      rateType: z.nativeEnum(RateType),
      ratePaise: z.number().int().min(0),
      sessionMinutes: z.number().int().min(5).max(240).nullable(),
    })
    .safeParse({
      mode: formData.get("mode"),
      enabled: formData.get("enabled") === "on",
      rateType: formData.get("rateType"),
      ratePaise: Number.isFinite(rupees) ? Math.round(rupees * 100) : -1,
      sessionMinutes: formData.get("sessionMinutes") ? Number(formData.get("sessionMinutes")) : null,
    });

  if (!parsed.success) return failure("Check the rate below.", {}, formData);

  try {
    await saveOwnService(auth.actor.userId, parsed.data);
  } catch (error) {
    if (error instanceof PanditServiceError) return failure(error.message, {}, formData);
    throw error;
  }

  revalidatePath("/pandit/services");
  revalidatePath("/pandit");
  return success("Saved.");
}

/**
 * Publishes the profile.
 *
 * Completion is re-derived from the database here. It is the same function that
 * draws the progress bar, so a Pandit can never be shown "100%" and then
 * refused, nor publish an incomplete profile because a stale page said they
 * could.
 */
export async function goLiveAction(
  _state: AdminActionState,
  _formData: FormData,
): Promise<AdminActionState> {
  const auth = await actingPandit({ requireApproved: true });
  if (!auth.ok) return denied(auth.error);

  const completion = await getCompletion(auth.actor.profileId);
  if (!completion.complete) {
    const missing = completion.requirements.filter((item) => !item.met).map((item) => item.label);
    return failure(`Still needed before you can go live: ${missing.join(", ")}.`);
  }

  const result = await applyTransition({
    panditProfileId: auth.actor.profileId,
    to: PanditOnboardingStatus.ACTIVE,
    actorUserId: auth.actor.userId,
    actorKind: "pandit",
  });

  if (!result.ok) return failure(result.message);

  revalidatePandit();
  revalidatePath("/pandits");
  return success("You are live and can now be booked.");
}

export async function pauseListingAction(
  _state: AdminActionState,
  _formData: FormData,
): Promise<AdminActionState> {
  const auth = await actingPandit({ requireApproved: true });
  if (!auth.ok) return denied(auth.error);

  const result = await applyTransition({
    panditProfileId: auth.actor.profileId,
    to: PanditOnboardingStatus.PROFILE_COMPLETION_REQUIRED,
    actorUserId: auth.actor.userId,
    actorKind: "pandit",
    note: "Paused by the Pandit.",
  });

  if (!result.ok) return failure(result.message);

  revalidatePandit();
  revalidatePath("/pandits");
  return success("Your listing is paused. Existing bookings are unaffected.");
}

/* ------------------------------------------------------------------ */
/* Schedule                                                            */
/* ------------------------------------------------------------------ */

export async function addScheduleRuleAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await actingPandit({ requireApproved: true });
  if (!auth.ok) return denied(auth.error);

  const start = parseMinutes(String(formData.get("start") ?? ""));
  const end = parseMinutes(String(formData.get("end") ?? ""));

  if (start === null || end === null) return failure("Use 24-hour times, like 09:00 and 12:30.", {}, formData);

  const parsed = scheduleRuleSchema.safeParse({
    weekday: Number(formData.get("weekday")),
    startMinute: start,
    endMinute: end,
  });

  if (!parsed.success) {
    return failure(
      z.flattenError(parsed.error).formErrors[0] ?? "Check the window below.",
      z.flattenError(parsed.error).fieldErrors,
      formData,
    );
  }

  try {
    await addScheduleRule(auth.actor.userId, parsed.data);
  } catch (error) {
    if (error instanceof ScheduleError) return failure(error.message, {}, formData);
    throw error;
  }

  revalidatePath("/pandit/schedule");
  return success("Availability added.");
}

export async function removeScheduleRuleAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await actingPandit({ requireApproved: true });
  if (!auth.ok) return denied(auth.error);

  const ruleId = formData.get("ruleId");
  if (typeof ruleId !== "string") return failure("That window is not recognised.");

  try {
    await removeScheduleRule(auth.actor.userId, ruleId);
  } catch (error) {
    if (error instanceof ScheduleError) return failure(error.message);
    throw error;
  }

  revalidatePath("/pandit/schedule");
  return success("Availability removed.");
}

export async function saveScheduleExceptionAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await actingPandit({ requireApproved: true });
  if (!auth.ok) return denied(auth.error);

  const available = formData.get("available") === "on";
  const start = formData.get("start") ? parseMinutes(String(formData.get("start"))) : null;
  const end = formData.get("end") ? parseMinutes(String(formData.get("end"))) : null;

  const parsed = scheduleExceptionSchema.safeParse({
    date: String(formData.get("date") ?? ""),
    available,
    startMinute: start,
    endMinute: end,
    note: (formData.get("note") as string)?.trim() || null,
  });

  if (!parsed.success) {
    return failure(
      z.flattenError(parsed.error).formErrors[0] ?? "Check the date below.",
      z.flattenError(parsed.error).fieldErrors,
      formData,
    );
  }

  try {
    await saveScheduleException(auth.actor.userId, parsed.data);
  } catch (error) {
    if (error instanceof ScheduleError) return failure(error.message, {}, formData);
    throw error;
  }

  revalidatePath("/pandit/schedule");
  return success(parsed.data.available ? "Extra availability added." : "Date blocked.");
}

export async function removeScheduleExceptionAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await actingPandit({ requireApproved: true });
  if (!auth.ok) return denied(auth.error);

  const exceptionId = formData.get("exceptionId");
  if (typeof exceptionId !== "string") return failure("That date is not recognised.");

  try {
    await removeScheduleException(auth.actor.userId, exceptionId);
  } catch (error) {
    if (error instanceof ScheduleError) return failure(error.message);
    throw error;
  }

  revalidatePath("/pandit/schedule");
  return success("Removed.");
}

/* ------------------------------------------------------------------ */
/* Payout account                                                      */
/* ------------------------------------------------------------------ */

export async function savePayoutAccountAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await actingPandit({ requireApproved: true });
  if (!auth.ok) return denied(auth.error);

  const parsed = payoutAccountSchema.safeParse({
    accountHolderName: formData.get("accountHolderName"),
    bankName: (formData.get("bankName") as string)?.trim() || null,
    accountNumber: (formData.get("accountNumber") as string)?.trim() || null,
    ifsc: (formData.get("ifsc") as string)?.trim() || null,
    upiId: (formData.get("upiId") as string)?.trim() || null,
    taxId: (formData.get("taxId") as string)?.trim() || null,
  });

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error);
    // Deliberately does not echo the submitted values back: a rejected bank
    // form should not put an account number into the action result, which is
    // serialised through the response.
    return failure(flattened.formErrors[0] ?? "Check the details below.", flattened.fieldErrors);
  }

  try {
    await saveOwnPayoutAccount(auth.actor.userId, parsed.data);
  } catch (error) {
    if (error instanceof PayoutAccountError) return failure(error.message);
    throw error;
  }

  revalidatePath("/pandit/payouts");
  revalidatePath("/pandit/profile");
  return success("Payout details saved. Only the masked form is shown from now on.");
}

/* ------------------------------------------------------------------ */
/* Consultations                                                       */
/* ------------------------------------------------------------------ */

/**
 * Marks a consultation complete and settles it.
 *
 * Settlement is idempotent - the earning row is unique per consultation - so a
 * double click, a retry or a second operator produces one earning.
 */
export async function completeConsultationAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await actingPandit({ requireApproved: true });
  if (!auth.ok) return denied(auth.error);

  const consultationId = formData.get("consultationId");
  if (typeof consultationId !== "string") return failure("That consultation is not recognised.");

  // Scoped to this Pandit's own consultations in the query, so another Pandit's
  // session resolves to "not found" rather than to a denial.
  const consultation = await prisma.consultation.findFirst({
    where: { id: consultationId, panditProfileId: auth.actor.profileId },
    select: { id: true, status: true },
  });

  if (!consultation) return failure("That consultation could not be found.");

  if (consultation.status === ConsultationStatus.COMPLETED) {
    return failure("That consultation is already complete.");
  }

  if (
    consultation.status !== ConsultationStatus.CONFIRMED &&
    consultation.status !== ConsultationStatus.IN_PROGRESS &&
    consultation.status !== ConsultationStatus.REQUESTED
  ) {
    return failure("Only a live consultation can be completed.");
  }

  await prisma.consultation.update({
    where: { id: consultation.id },
    data: { status: ConsultationStatus.COMPLETED, completedAt: new Date(), endedAt: new Date() },
  });

  const settlement = await settleConsultation({
    consultationId: consultation.id,
    actorUserId: auth.actor.userId,
  });

  revalidatePath("/pandit/consultations");
  revalidatePath("/pandit/earnings");
  revalidatePath("/admin/earnings");

  return success(
    settlement.ok && settlement.created
      ? "Marked complete. The earning is now in your ledger."
      : "Marked complete.",
  );
}

/* ------------------------------------------------------------------ */
/* Tickets                                                             */
/* ------------------------------------------------------------------ */

export async function createPanditTicketAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const viewer = await getViewer();
  if (!viewer) return denied("Sign in first.");

  const decision = await checkRateLimit({ namespace: "ticket:create", identifier: `user:${viewer.id}` });
  if (!decision.allowed) return failure(rateLimitMessage(decision.retryAfterSeconds));

  const parsed = ticketInputSchema.safeParse({
    category: formData.get("category"),
    subject: formData.get("subject"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return failure("Check the details below.", z.flattenError(parsed.error).fieldErrors, formData);
  }

  const result = await createTicket({ userId: viewer.id, role: viewer.role, ticket: parsed.data });

  revalidatePath("/pandit/tickets");
  revalidatePath("/admin/tickets");
  revalidatePath("/employee/tickets");
  return success(`Raised as ${result.ticketNumber}. Support will reply on this ticket.`);
}

export async function replyToOwnTicketAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const viewer = await getViewer();
  if (!viewer) return denied("Sign in first.");

  const ticketId = formData.get("ticketId");
  const body = formData.get("body");

  if (typeof ticketId !== "string" || typeof body !== "string") {
    return failure("Write a reply first.");
  }

  const result = await replyToTicket({
    ticketId,
    authorUserId: viewer.id,
    body,
    // A reporter's reply is never an internal note, whatever the form says.
    internal: false,
    canManage: false,
  });

  if (!result.ok) return failure(result.message);

  revalidatePath("/pandit/tickets");
  revalidatePath(`/pandit/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
  return success("Reply sent.");
}
