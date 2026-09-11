import "server-only";

import {
  AuditAction,
  ConsultationMode,
  PanditDocumentStatus,
  PanditOnboardingStatus,
  PanditReviewDecision,
  Prisma,
  RateType,
  UserRole,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/admin/audit";
import { getSettings } from "@/lib/settings/service";
import { EXPERTISE_OPTIONS, LANGUAGE_OPTIONS, REQUIRED_DOCUMENT_TYPES } from "@/lib/pandit/catalog";
import {
  completionPercent,
  findTransition,
  isProfileComplete,
  profileRequirements,
  type ProfileCompletionInput,
} from "@/lib/pandit/onboarding";

/**
 * Pandit profile and onboarding operations.
 *
 * Two rules hold throughout:
 *
 *  1. Every status change goes through `applyTransition`, which checks the move
 *     against the declared table and records both a review-trail entry and an
 *     audit entry in the same transaction. There is no other way to write
 *     `status`, so an illegal move is not a check someone could forget.
 *
 *  2. Ownership is scoped inside the query (`where: { id, userId }`) rather than
 *     compared after fetching, so a Pandit asking about somebody else's profile
 *     gets "not found" rather than a row they then have to be denied.
 */

const S = PanditOnboardingStatus;

export class PanditServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PanditServiceError";
  }
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

const profileSelect = {
  id: true,
  userId: true,
  status: true,
  displayName: true,
  slug: true,
  headline: true,
  bio: true,
  profileImageUrl: true,
  phone: true,
  city: true,
  state: true,
  country: true,
  timezone: true,
  yearsOfExperience: true,
  languages: true,
  expertise: true,
  certifications: true,
  commissionPercent: true,
  submittedAt: true,
  reviewStartedAt: true,
  changesRequestedAt: true,
  changeRequestNote: true,
  verifiedAt: true,
  approvedAt: true,
  activatedAt: true,
  rejectedAt: true,
  rejectionReason: true,
  suspendedAt: true,
  suspensionReason: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.PanditProfileSelect;

export type PanditProfileRecord = Prisma.PanditProfileGetPayload<{ select: typeof profileSelect }>;

/** The acting Pandit's own profile, or null when they do not have one. */
export async function getOwnPanditProfile(userId: string): Promise<PanditProfileRecord | null> {
  return prisma.panditProfile.findUnique({ where: { userId }, select: profileSelect });
}

/**
 * Creates the application, or returns the existing one.
 *
 * Idempotent so a double submit from a slow page cannot produce two
 * applications, and so re-entering the flow after abandoning it resumes rather
 * than restarting.
 *
 * The role is set here, on the server, and only ever to PANDIT. That is safe
 * precisely because PANDIT carries no permissions: an applicant at REQUESTED
 * can reach their own onboarding and nothing else, and everything that matters
 * - being listed, taking bookings, being paid - is gated on the onboarding
 * status, which only a reviewer can advance.
 */
export async function startPanditApplication(userId: string): Promise<PanditProfileRecord> {
  const existing = await prisma.panditProfile.findUnique({ where: { userId }, select: profileSelect });
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) throw new PanditServiceError("Account not found.");

    // An operator applying to practise would otherwise lose their operator
    // access the moment they applied. Refuse rather than silently demote.
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN || user.role === UserRole.EMPLOYEE) {
      throw new PanditServiceError(
        "This account holds a staff role. Use a separate account to apply as a Pandit.",
      );
    }

    const profile = await tx.panditProfile.create({
      data: {
        userId: user.id,
        status: S.REQUESTED,
        displayName: user.name || user.email.split("@")[0],
        languages: [],
        expertise: [],
        certifications: [],
      },
      select: profileSelect,
    });

    if (user.role !== UserRole.PANDIT) {
      await tx.user.update({ where: { id: user.id }, data: { role: UserRole.PANDIT } });
    }

    await tx.panditReview.create({
      data: {
        panditProfileId: profile.id,
        reviewerId: null,
        decision: PanditReviewDecision.SUBMITTED,
        fromStatus: S.REQUESTED,
        toStatus: S.REQUESTED,
        note: "Application opened by the applicant.",
      },
    });

    await recordAudit(tx, {
      actorUserId: user.id,
      action: AuditAction.USER_ROLE_CHANGED,
      entityType: "User",
      entityId: user.id,
      metadata: { from: user.role, to: UserRole.PANDIT, via: "pandit-application" },
    });

    return profile;
  });
}

/* ------------------------------------------------------------------ */
/* Transitions                                                         */
/* ------------------------------------------------------------------ */

const STATUS_AUDIT: Partial<Record<PanditOnboardingStatus, AuditAction>> = {
  [S.SUBMITTED]: AuditAction.PANDIT_APPLICATION_SUBMITTED,
  [S.UNDER_REVIEW]: AuditAction.PANDIT_REVIEW_STARTED,
  [S.CHANGES_REQUESTED]: AuditAction.PANDIT_CHANGES_REQUESTED,
  [S.VERIFIED]: AuditAction.PANDIT_VERIFIED,
  [S.APPROVED]: AuditAction.PANDIT_APPROVED,
  [S.ACTIVE]: AuditAction.PANDIT_ACTIVATED,
  [S.REJECTED]: AuditAction.PANDIT_REJECTED,
  [S.SUSPENDED]: AuditAction.PANDIT_SUSPENDED,
};

export type TransitionInput = {
  panditProfileId: string;
  to: PanditOnboardingStatus;
  actorUserId: string;
  /** Which side of the table the actor is acting from. Checked against the rule. */
  actorKind: "pandit" | "reviewer" | "approver";
  note?: string | null;
};

export type TransitionResult =
  | { ok: true; status: PanditOnboardingStatus }
  | { ok: false; message: string };

/**
 * The only writer of `PanditProfile.status`.
 *
 * Reloads the current status inside the transaction and re-checks the move
 * against it, so two reviewers acting at once cannot both apply a transition
 * that was only legal from the state the first one left.
 */
export async function applyTransition(input: TransitionInput): Promise<TransitionResult> {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.panditProfile.findUnique({
      where: { id: input.panditProfileId },
      select: { id: true, userId: true, status: true, displayName: true, slug: true },
    });

    if (!profile) return { ok: false as const, message: "That Pandit could not be found." };

    const rule = findTransition(profile.status, input.to);
    if (!rule) {
      return {
        ok: false as const,
        message: `A Pandit cannot move from ${profile.status} to ${input.to}.`,
      };
    }

    // An approver may also act where a reviewer may; the reverse is not true.
    const actorSatisfies =
      rule.actor === input.actorKind || (rule.actor === "reviewer" && input.actorKind === "approver");

    if (!actorSatisfies) {
      return { ok: false as const, message: "That decision is not yours to make." };
    }

    // A Pandit acting on their own application must be the owner of it. This is
    // the check that makes self-approval structurally impossible even if the
    // transition table were ever loosened: the only moves a "pandit" actor can
    // make are the ones the table gives that actor.
    if (input.actorKind === "pandit" && profile.userId !== input.actorUserId) {
      return { ok: false as const, message: "That application is not yours." };
    }

    const now = new Date();
    const data: Prisma.PanditProfileUpdateInput = { status: input.to };

    switch (input.to) {
      case S.SUBMITTED:
        data.submittedAt = now;
        data.changeRequestNote = null;
        break;
      case S.UNDER_REVIEW:
        data.reviewStartedAt = now;
        break;
      case S.CHANGES_REQUESTED:
        data.changesRequestedAt = now;
        data.changeRequestNote = input.note ?? null;
        break;
      case S.VERIFIED:
        data.verifiedAt = now;
        data.verifiedBy = { connect: { id: input.actorUserId } };
        break;
      case S.APPROVED:
        data.approvedAt = now;
        data.approvedBy = { connect: { id: input.actorUserId } };
        break;
      case S.ACTIVE:
        data.activatedAt = now;
        data.suspendedAt = null;
        data.suspensionReason = null;
        // The public slug is minted here and nowhere else, so an application
        // that never reached ACTIVE has no addressable public page even to
        // someone guessing URLs.
        if (!profile.slug) {
          data.slug = await mintSlug(tx, profile.displayName || "pandit", profile.id);
        }
        break;
      case S.REJECTED:
        data.rejectedAt = now;
        data.rejectedBy = { connect: { id: input.actorUserId } };
        data.rejectionReason = input.note ?? null;
        break;
      case S.SUSPENDED:
        data.suspendedAt = now;
        data.suspendedBy = { connect: { id: input.actorUserId } };
        data.suspensionReason = input.note ?? null;
        break;
      default:
        break;
    }

    await tx.panditProfile.update({ where: { id: profile.id }, data });

    await tx.panditReview.create({
      data: {
        panditProfileId: profile.id,
        reviewerId: input.actorUserId,
        decision: rule.decision ?? PanditReviewDecision.SUBMITTED,
        fromStatus: profile.status,
        toStatus: input.to,
        note: input.note ?? null,
      },
    });

    const auditAction = STATUS_AUDIT[input.to];
    if (auditAction) {
      await recordAudit(tx, {
        actorUserId: input.actorUserId,
        action:
          input.to === S.ACTIVE && profile.status === S.SUSPENDED
            ? AuditAction.PANDIT_REINSTATED
            : auditAction,
        entityType: "PanditProfile",
        entityId: profile.id,
        // Note text is the reviewer's own words about the application, which is
        // exactly the kind of descriptive value the audit log is for. No
        // document contents, no credentials.
        metadata: { from: profile.status, to: input.to, note: input.note ?? null },
      });
    }

    return { ok: true as const, status: input.to };
  });
}

/** A unique, URL-safe public handle derived from the display name. */
async function mintSlug(tx: Prisma.TransactionClient, displayName: string, profileId: string): Promise<string> {
  const base =
    displayName
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "pandit";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await tx.panditProfile.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }

  // Falls back to something guaranteed unique rather than looping forever.
  return `${base}-${profileId.slice(-6)}`;
}

/* ------------------------------------------------------------------ */
/* Profile editing                                                     */
/* ------------------------------------------------------------------ */

export const basicDetailsSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(6).max(20),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
  country: z.string().trim().min(2).max(2).default("IN"),
  timezone: z.string().trim().min(1).max(64).default("Asia/Kolkata"),
  yearsOfExperience: z.number().int().min(0).max(90),
});

export const professionalProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  headline: z.string().trim().max(140).nullable(),
  bio: z.string().trim().min(80).max(4_000),
  profileImageUrl: z.string().trim().url().max(500).nullable(),
  languages: z.array(z.enum(LANGUAGE_OPTIONS)).min(1).max(LANGUAGE_OPTIONS.length),
  expertise: z.array(z.enum(EXPERTISE_OPTIONS)).min(1).max(EXPERTISE_OPTIONS.length),
  certifications: z.array(z.string().trim().min(2).max(120)).max(10),
  yearsOfExperience: z.number().int().min(0).max(90),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
});

/**
 * Writes profile fields the Pandit owns.
 *
 * `status`, `commissionPercent`, `slug` and every reviewer timestamp are absent
 * from both schemas above, so no shape of form submission reaches them: a
 * Pandit editing their bio cannot also edit their own verification state.
 */
export async function updateOwnProfile(
  userId: string,
  data: Partial<z.infer<typeof professionalProfileSchema>> & Partial<z.infer<typeof basicDetailsSchema>>,
): Promise<void> {
  const updated = await prisma.panditProfile.updateMany({
    where: { userId },
    data: {
      ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      ...(data.headline !== undefined ? { headline: data.headline } : {}),
      ...(data.bio !== undefined ? { bio: data.bio } : {}),
      ...(data.profileImageUrl !== undefined ? { profileImageUrl: data.profileImageUrl } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.city !== undefined ? { city: data.city } : {}),
      ...(data.state !== undefined ? { state: data.state } : {}),
      ...(data.country !== undefined ? { country: data.country } : {}),
      ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      ...(data.yearsOfExperience !== undefined ? { yearsOfExperience: data.yearsOfExperience } : {}),
      ...(data.languages !== undefined ? { languages: data.languages } : {}),
      ...(data.expertise !== undefined ? { expertise: data.expertise } : {}),
      ...(data.certifications !== undefined ? { certifications: data.certifications } : {}),
    },
  });

  if (updated.count === 0) throw new PanditServiceError("No Pandit profile for this account.");
}

/* ------------------------------------------------------------------ */
/* Services and rates                                                  */
/* ------------------------------------------------------------------ */

export const serviceInputSchema = z.object({
  mode: z.nativeEnum(ConsultationMode),
  enabled: z.boolean(),
  rateType: z.nativeEnum(RateType),
  ratePaise: z.number().int().min(0).max(10_000_000),
  sessionMinutes: z.number().int().min(5).max(240).nullable(),
});

export type ServiceInput = z.infer<typeof serviceInputSchema>;

/**
 * Saves one consultation type and its rate.
 *
 * The rate is checked against the platform bounds here, on the server, on every
 * write. The bounds are read at write time and not copied onto the row, so an
 * operator widening the ceiling next month never silently reprices anyone, and
 * narrowing it never invalidates a rate already agreed on a booked session -
 * those carry their own snapshot.
 */
export async function saveOwnService(userId: string, input: ServiceInput): Promise<void> {
  const profile = await prisma.panditProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) throw new PanditServiceError("No Pandit profile for this account.");

  const settings = await getSettings([
    "consultations.allowedModes",
    "consultations.minRatePaise",
    "consultations.maxRatePaise",
  ]);

  if (input.enabled && !settings["consultations.allowedModes"].includes(input.mode)) {
    throw new PanditServiceError("That consultation type is not currently offered by the platform.");
  }

  if (input.enabled) {
    if (input.ratePaise < settings["consultations.minRatePaise"]) {
      throw new PanditServiceError("That rate is below the platform minimum.");
    }
    if (input.ratePaise > settings["consultations.maxRatePaise"]) {
      throw new PanditServiceError("That rate is above the platform maximum.");
    }
    if (input.rateType === RateType.FIXED_SESSION && !input.sessionMinutes) {
      throw new PanditServiceError("A fixed-session rate needs a session length.");
    }
  }

  await prisma.panditService.upsert({
    where: { panditProfileId_mode: { panditProfileId: profile.id, mode: input.mode } },
    update: {
      enabled: input.enabled,
      rateType: input.rateType,
      ratePaise: input.ratePaise,
      sessionMinutes: input.rateType === RateType.FIXED_SESSION ? input.sessionMinutes : null,
    },
    create: {
      panditProfileId: profile.id,
      mode: input.mode,
      enabled: input.enabled,
      rateType: input.rateType,
      ratePaise: input.ratePaise,
      sessionMinutes: input.rateType === RateType.FIXED_SESSION ? input.sessionMinutes : null,
    },
  });
}

/* ------------------------------------------------------------------ */
/* Completion                                                          */
/* ------------------------------------------------------------------ */

export type CompletionSnapshot = {
  percent: number;
  complete: boolean;
  requirements: ReturnType<typeof profileRequirements>;
};

/**
 * Assembles the completion picture from live data.
 *
 * Both the percentage shown to the Pandit and the precondition on going live
 * come from this one function, so the bar they see filling and the rule that
 * lets them publish cannot disagree.
 */
export async function getCompletion(panditProfileId: string): Promise<CompletionSnapshot> {
  const profile = await prisma.panditProfile.findUnique({
    where: { id: panditProfileId },
    select: {
      displayName: true,
      bio: true,
      profileImageUrl: true,
      yearsOfExperience: true,
      languages: true,
      expertise: true,
      city: true,
      services: { where: { enabled: true }, select: { id: true } },
      scheduleRules: { select: { id: true } },
      payoutAccount: { select: { id: true } },
    },
  });

  if (!profile) throw new PanditServiceError("That Pandit could not be found.");

  const input: ProfileCompletionInput = {
    displayName: profile.displayName,
    bio: profile.bio,
    profileImageUrl: profile.profileImageUrl,
    yearsOfExperience: profile.yearsOfExperience,
    languages: profile.languages,
    expertise: profile.expertise,
    city: profile.city,
    enabledServiceCount: profile.services.length,
    scheduleRuleCount: profile.scheduleRules.length,
    hasPayoutAccount: profile.payoutAccount !== null,
  };

  return {
    percent: completionPercent(input),
    complete: isProfileComplete(input),
    requirements: profileRequirements(input),
  };
}

/**
 * Whether an application has everything it needs to be submitted.
 *
 * Checked on submit rather than trusted from the form, so a crafted request
 * cannot put an empty application into the reviewer's queue.
 */
export async function canSubmitApplication(
  panditProfileId: string,
): Promise<{ ok: true } | { ok: false; missing: string[] }> {
  const profile = await prisma.panditProfile.findUnique({
    where: { id: panditProfileId },
    select: {
      displayName: true,
      phone: true,
      city: true,
      state: true,
      yearsOfExperience: true,
      expertise: true,
      languages: true,
      documents: { select: { type: true, status: true } },
    },
  });

  if (!profile) return { ok: false, missing: ["Profile not found"] };

  const missing: string[] = [];
  if (profile.displayName.trim().length < 2) missing.push("Full name");
  if (!profile.phone) missing.push("Phone number");
  if (!profile.city) missing.push("City");
  if (!profile.state) missing.push("State");
  if (profile.yearsOfExperience === null) missing.push("Years of experience");
  if (profile.expertise.length === 0) missing.push("At least one specialisation");
  if (profile.languages.length === 0) missing.push("At least one language");

  for (const required of REQUIRED_DOCUMENT_TYPES) {
    const present = profile.documents.some(
      (document) => document.type === required && document.status !== PanditDocumentStatus.REJECTED,
    );
    if (!present) missing.push(`A ${required.toLowerCase()} document`);
  }

  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}
