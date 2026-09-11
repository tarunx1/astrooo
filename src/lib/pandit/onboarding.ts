import { PanditOnboardingStatus, PanditReviewDecision } from "@prisma/client";

/**
 * The Pandit onboarding state machine.
 *
 * One status column, one declared transition table, one place that decides
 * whether a move is legal. The alternative - `isVerified`, `isApproved`,
 * `isActive`, `hasDocuments` - has sixteen combinations of which four are
 * meaningful, nothing stops code from writing one of the other twelve, and
 * "can this person take a booking?" becomes a question nobody can answer
 * without reading every write site.
 *
 * Kept free of `server-only` and of Prisma's runtime so the rules can be
 * unit-tested directly; the service that applies them lives in `service.ts`.
 */
export type OnboardingStatus = PanditOnboardingStatus;

/**
 * Who is allowed to make a move.
 *
 * "pandit" moves are the applicant's own progress through their application.
 * "reviewer" moves are an employee's or admin's verification decisions.
 * "approver" moves are the final approval and the suspend/reinstate controls,
 * which default to Super Admin.
 */
export type TransitionActor = "pandit" | "reviewer" | "approver";

export type TransitionRule = {
  to: OnboardingStatus;
  actor: TransitionActor;
  decision: PanditReviewDecision | null;
  /** Why this move exists, in the reviewer's language. */
  label: string;
};

const S = PanditOnboardingStatus;
const D = PanditReviewDecision;

/**
 * Every legal move, keyed by the state it leaves.
 *
 * A move not listed here is impossible - refused at the service boundary, not
 * merely absent from a dropdown. Notably, nothing lets a Pandit reach VERIFIED,
 * APPROVED or ACTIVE: every one of those has actor "reviewer" or "approver", so
 * self-approval is not a check that could be forgotten, it is a transition that
 * does not exist.
 */
export const TRANSITIONS: Readonly<Record<OnboardingStatus, readonly TransitionRule[]>> = {
  [S.REQUESTED]: [
    { to: S.PROFILE_STARTED, actor: "pandit", decision: null, label: "Start onboarding" },
  ],
  [S.PROFILE_STARTED]: [
    { to: S.DOCUMENTS_PENDING, actor: "pandit", decision: null, label: "Save basic details" },
  ],
  [S.DOCUMENTS_PENDING]: [
    { to: S.SUBMITTED, actor: "pandit", decision: D.SUBMITTED, label: "Submit for review" },
  ],
  [S.SUBMITTED]: [
    { to: S.UNDER_REVIEW, actor: "reviewer", decision: D.REVIEW_STARTED, label: "Start review" },
    { to: S.CHANGES_REQUESTED, actor: "reviewer", decision: D.CHANGES_REQUESTED, label: "Request changes" },
    { to: S.REJECTED, actor: "reviewer", decision: D.REJECTED, label: "Reject" },
  ],
  [S.UNDER_REVIEW]: [
    { to: S.CHANGES_REQUESTED, actor: "reviewer", decision: D.CHANGES_REQUESTED, label: "Request changes" },
    { to: S.VERIFIED, actor: "reviewer", decision: D.VERIFIED, label: "Verify" },
    { to: S.REJECTED, actor: "reviewer", decision: D.REJECTED, label: "Reject" },
  ],
  [S.CHANGES_REQUESTED]: [
    { to: S.SUBMITTED, actor: "pandit", decision: D.SUBMITTED, label: "Resubmit" },
    { to: S.REJECTED, actor: "reviewer", decision: D.REJECTED, label: "Reject" },
  ],
  [S.VERIFIED]: [
    { to: S.APPROVED, actor: "approver", decision: D.APPROVED, label: "Approve" },
    { to: S.CHANGES_REQUESTED, actor: "reviewer", decision: D.CHANGES_REQUESTED, label: "Request changes" },
    { to: S.REJECTED, actor: "approver", decision: D.REJECTED, label: "Reject" },
  ],
  [S.APPROVED]: [
    // Approval is the platform's decision; completing the professional profile
    // is the Pandit's work, and it is what stands between approval and being
    // publicly bookable.
    { to: S.PROFILE_COMPLETION_REQUIRED, actor: "pandit", decision: null, label: "Begin profile completion" },
    { to: S.SUSPENDED, actor: "approver", decision: D.SUSPENDED, label: "Suspend" },
  ],
  [S.PROFILE_COMPLETION_REQUIRED]: [
    { to: S.ACTIVE, actor: "pandit", decision: D.ACTIVATED, label: "Go live" },
    { to: S.SUSPENDED, actor: "approver", decision: D.SUSPENDED, label: "Suspend" },
  ],
  [S.ACTIVE]: [
    { to: S.SUSPENDED, actor: "approver", decision: D.SUSPENDED, label: "Suspend" },
    // Stepping back when a required field is cleared. Not a punishment: it is
    // how the "complete profile before being bookable" rule stays true after
    // the profile is first completed.
    { to: S.PROFILE_COMPLETION_REQUIRED, actor: "pandit", decision: null, label: "Pause listing" },
  ],
  [S.SUSPENDED]: [
    { to: S.ACTIVE, actor: "approver", decision: D.REINSTATED, label: "Reinstate" },
    { to: S.REJECTED, actor: "approver", decision: D.REJECTED, label: "Reject" },
  ],
  [S.REJECTED]: [
    // A rejection is not permanent, but re-entry starts the review again rather
    // than resuming wherever the application was when it was refused.
    { to: S.SUBMITTED, actor: "approver", decision: D.SUBMITTED, label: "Reopen application" },
  ],
};

export function allowedTransitions(from: OnboardingStatus): readonly TransitionRule[] {
  return TRANSITIONS[from] ?? [];
}

export function findTransition(
  from: OnboardingStatus,
  to: OnboardingStatus,
): TransitionRule | null {
  return allowedTransitions(from).find((rule) => rule.to === to) ?? null;
}

export function canTransition(from: OnboardingStatus, to: OnboardingStatus): boolean {
  return findTransition(from, to) !== null;
}

/**
 * States in which the Pandit is a customer-visible, bookable professional.
 *
 * The single answer to "may this person take a booking?". Every booking path
 * asks this rather than re-deriving it, so there is no second definition to
 * drift.
 */
export function isBookable(status: OnboardingStatus): boolean {
  return status === S.ACTIVE;
}

/** States in which the full consultation toolset is available in the dashboard. */
export function isApprovedOrLater(status: OnboardingStatus): boolean {
  return (
    status === S.APPROVED || status === S.PROFILE_COMPLETION_REQUIRED || status === S.ACTIVE
  );
}

/** States in which the applicant may still edit their application. */
export function isEditableByPandit(status: OnboardingStatus): boolean {
  return (
    status === S.REQUESTED ||
    status === S.PROFILE_STARTED ||
    status === S.DOCUMENTS_PENDING ||
    status === S.CHANGES_REQUESTED
  );
}

/** States that belong in a reviewer's queue. */
export const REVIEW_QUEUE_STATUSES: readonly OnboardingStatus[] = [
  S.SUBMITTED,
  S.UNDER_REVIEW,
  S.CHANGES_REQUESTED,
  S.VERIFIED,
];

export const STATUS_LABEL: Readonly<Record<OnboardingStatus, string>> = {
  [S.REQUESTED]: "Requested",
  [S.PROFILE_STARTED]: "Profile started",
  [S.DOCUMENTS_PENDING]: "Documents pending",
  [S.SUBMITTED]: "Submitted",
  [S.UNDER_REVIEW]: "Under review",
  [S.CHANGES_REQUESTED]: "Changes requested",
  [S.VERIFIED]: "Verified",
  [S.APPROVED]: "Approved",
  [S.PROFILE_COMPLETION_REQUIRED]: "Profile completion required",
  [S.ACTIVE]: "Active",
  [S.REJECTED]: "Rejected",
  [S.SUSPENDED]: "Suspended",
};

export type StatusTone = "positive" | "warning" | "danger" | "neutral" | "info";

export const STATUS_TONE: Readonly<Record<OnboardingStatus, StatusTone>> = {
  [S.REQUESTED]: "neutral",
  [S.PROFILE_STARTED]: "neutral",
  [S.DOCUMENTS_PENDING]: "warning",
  [S.SUBMITTED]: "info",
  [S.UNDER_REVIEW]: "info",
  [S.CHANGES_REQUESTED]: "warning",
  [S.VERIFIED]: "info",
  [S.APPROVED]: "positive",
  [S.PROFILE_COMPLETION_REQUIRED]: "warning",
  [S.ACTIVE]: "positive",
  [S.REJECTED]: "danger",
  [S.SUSPENDED]: "danger",
};

/**
 * The ordered steps shown as onboarding progress.
 *
 * Terminal states are absent by design: a rejected or suspended applicant is
 * not "somewhere along the path", and drawing them on it would be misleading.
 */
export const ONBOARDING_STEPS: readonly OnboardingStatus[] = [
  S.REQUESTED,
  S.PROFILE_STARTED,
  S.DOCUMENTS_PENDING,
  S.SUBMITTED,
  S.UNDER_REVIEW,
  S.VERIFIED,
  S.APPROVED,
  S.PROFILE_COMPLETION_REQUIRED,
  S.ACTIVE,
];

/** How far along the steps a status sits; -1 for a state off the path. */
export function stepIndex(status: OnboardingStatus): number {
  return ONBOARDING_STEPS.indexOf(status);
}

/**
 * The fields a Pandit must supply before they can be publicly listed.
 *
 * Used both for the completion percentage and as the precondition on going
 * live, so the number shown and the rule enforced cannot disagree.
 */
export type ProfileCompletionInput = {
  displayName: string;
  bio: string | null;
  profileImageUrl: string | null;
  yearsOfExperience: number | null;
  languages: readonly string[];
  expertise: readonly string[];
  city: string | null;
  enabledServiceCount: number;
  scheduleRuleCount: number;
  hasPayoutAccount: boolean;
};

export type CompletionRequirement = { key: string; label: string; met: boolean };

export function profileRequirements(input: ProfileCompletionInput): CompletionRequirement[] {
  return [
    { key: "displayName", label: "Display name", met: input.displayName.trim().length >= 2 },
    { key: "bio", label: "Professional bio", met: (input.bio ?? "").trim().length >= 80 },
    { key: "photo", label: "Profile photo", met: Boolean(input.profileImageUrl) },
    {
      key: "experience",
      label: "Years of experience",
      met: input.yearsOfExperience !== null && input.yearsOfExperience >= 0,
    },
    { key: "languages", label: "At least one language", met: input.languages.length > 0 },
    { key: "expertise", label: "At least one specialisation", met: input.expertise.length > 0 },
    { key: "city", label: "City", met: Boolean(input.city?.trim()) },
    { key: "services", label: "At least one consultation type with a rate", met: input.enabledServiceCount > 0 },
    { key: "schedule", label: "At least one weekly availability window", met: input.scheduleRuleCount > 0 },
    { key: "payout", label: "Payout account", met: input.hasPayoutAccount },
  ];
}

export function completionPercent(input: ProfileCompletionInput): number {
  const requirements = profileRequirements(input);
  const met = requirements.filter((requirement) => requirement.met).length;
  return Math.round((met / requirements.length) * 100);
}

export function isProfileComplete(input: ProfileCompletionInput): boolean {
  return profileRequirements(input).every((requirement) => requirement.met);
}
