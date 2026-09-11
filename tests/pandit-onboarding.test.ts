import { describe, expect, it } from "vitest";
import { PanditOnboardingStatus } from "@prisma/client";
import {
  ONBOARDING_STEPS,
  REVIEW_QUEUE_STATUSES,
  STATUS_LABEL,
  STATUS_TONE,
  TRANSITIONS,
  allowedTransitions,
  canTransition,
  completionPercent,
  findTransition,
  isApprovedOrLater,
  isBookable,
  isEditableByPandit,
  isProfileComplete,
  profileRequirements,
  type ProfileCompletionInput,
} from "@/lib/pandit/onboarding";
import { splitEarning } from "@/lib/payouts/ledger";
import { PAYOUT_TRANSITIONS, canTransitionPayout } from "@/lib/payouts/states";

const S = PanditOnboardingStatus;

/**
 * The onboarding state machine.
 *
 * The property that matters most is stated as its own test: there is no path by
 * which a Pandit reaches VERIFIED, APPROVED or ACTIVE-from-SUSPENDED on their
 * own authority. That is not a check the service performs and could forget - it
 * is a transition that does not exist in the table.
 */
describe("pandit onboarding transitions", () => {
  it("never lets the applicant verify, approve or reinstate themselves", () => {
    for (const [, rules] of Object.entries(TRANSITIONS)) {
      for (const rule of rules) {
        if (rule.actor !== "pandit") continue;

        expect(rule.to).not.toBe(S.VERIFIED);
        expect(rule.to).not.toBe(S.APPROVED);
        expect(rule.to).not.toBe(S.REJECTED);
        expect(rule.to).not.toBe(S.SUSPENDED);
      }
    }
  });

  it("only lets the applicant reach ACTIVE from profile completion", () => {
    const panditRoutesToActive = Object.entries(TRANSITIONS).flatMap(([from, rules]) =>
      rules.filter((rule) => rule.actor === "pandit" && rule.to === S.ACTIVE).map(() => from),
    );

    expect(panditRoutesToActive).toEqual([S.PROFILE_COMPLETION_REQUIRED]);
  });

  it("requires an approver to reinstate a suspended pandit", () => {
    const rule = findTransition(S.SUSPENDED, S.ACTIVE);
    expect(rule).not.toBeNull();
    expect(rule?.actor).toBe("approver");
  });

  it("requires an approver for final approval", () => {
    const rule = findTransition(S.VERIFIED, S.APPROVED);
    expect(rule?.actor).toBe("approver");
  });

  it("lets a reviewer verify but not approve", () => {
    expect(findTransition(S.UNDER_REVIEW, S.VERIFIED)?.actor).toBe("reviewer");
    expect(findTransition(S.UNDER_REVIEW, S.APPROVED)).toBeNull();
  });

  it("refuses moves that skip the queue", () => {
    expect(canTransition(S.REQUESTED, S.ACTIVE)).toBe(false);
    expect(canTransition(S.REQUESTED, S.APPROVED)).toBe(false);
    expect(canTransition(S.SUBMITTED, S.ACTIVE)).toBe(false);
    expect(canTransition(S.DOCUMENTS_PENDING, S.VERIFIED)).toBe(false);
  });

  it("walks the happy path end to end", () => {
    const path: PanditOnboardingStatus[] = [
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

    for (let index = 0; index < path.length - 1; index += 1) {
      expect(canTransition(path[index], path[index + 1])).toBe(true);
    }
  });

  it("lets a correction round-trip without losing the application", () => {
    expect(canTransition(S.UNDER_REVIEW, S.CHANGES_REQUESTED)).toBe(true);
    expect(canTransition(S.CHANGES_REQUESTED, S.SUBMITTED)).toBe(true);
  });

  it("treats PAID-equivalent terminal states as terminal", () => {
    // A rejected application can be reopened, but only by an approver and only
    // back into the review queue - never straight to ACTIVE.
    const fromRejected = allowedTransitions(S.REJECTED);
    expect(fromRejected.every((rule) => rule.actor === "approver")).toBe(true);
    expect(fromRejected.map((rule) => rule.to)).toEqual([S.SUBMITTED]);
  });

  it("declares a label and tone for every status", () => {
    for (const status of Object.values(PanditOnboardingStatus)) {
      expect(STATUS_LABEL[status]).toBeTruthy();
      expect(STATUS_TONE[status]).toBeTruthy();
    }
  });

  it("keeps terminal states off the progress track", () => {
    expect(ONBOARDING_STEPS).not.toContain(S.REJECTED);
    expect(ONBOARDING_STEPS).not.toContain(S.SUSPENDED);
    expect(ONBOARDING_STEPS).not.toContain(S.CHANGES_REQUESTED);
  });
});

describe("bookability", () => {
  it("is true for ACTIVE and nothing else", () => {
    for (const status of Object.values(PanditOnboardingStatus)) {
      expect(isBookable(status)).toBe(status === S.ACTIVE);
    }
  });

  it("does not treat an approved but unlisted pandit as bookable", () => {
    expect(isBookable(S.APPROVED)).toBe(false);
    expect(isBookable(S.PROFILE_COMPLETION_REQUIRED)).toBe(false);
  });

  it("does not treat a suspended pandit as bookable", () => {
    expect(isBookable(S.SUSPENDED)).toBe(false);
  });

  it("opens the professional toolset only from approval onwards", () => {
    expect(isApprovedOrLater(S.SUBMITTED)).toBe(false);
    expect(isApprovedOrLater(S.VERIFIED)).toBe(false);
    expect(isApprovedOrLater(S.APPROVED)).toBe(true);
    expect(isApprovedOrLater(S.ACTIVE)).toBe(true);
    expect(isApprovedOrLater(S.SUSPENDED)).toBe(false);
  });

  it("locks the application while a reviewer holds it", () => {
    expect(isEditableByPandit(S.SUBMITTED)).toBe(false);
    expect(isEditableByPandit(S.UNDER_REVIEW)).toBe(false);
    expect(isEditableByPandit(S.CHANGES_REQUESTED)).toBe(true);
    expect(isEditableByPandit(S.DOCUMENTS_PENDING)).toBe(true);
  });

  it("puts everything a reviewer acts on in the queue", () => {
    expect(REVIEW_QUEUE_STATUSES).toContain(S.SUBMITTED);
    expect(REVIEW_QUEUE_STATUSES).toContain(S.UNDER_REVIEW);
    expect(REVIEW_QUEUE_STATUSES).toContain(S.VERIFIED);
    expect(REVIEW_QUEUE_STATUSES).not.toContain(S.ACTIVE);
  });
});

describe("profile completion", () => {
  const complete: ProfileCompletionInput = {
    displayName: "Pandit Example",
    bio: "x".repeat(90),
    profileImageUrl: "https://example.test/photo.jpg",
    yearsOfExperience: 12,
    languages: ["Hindi"],
    expertise: ["Vedic Astrology"],
    city: "Amritsar",
    enabledServiceCount: 1,
    scheduleRuleCount: 1,
    hasPayoutAccount: true,
  };

  it("reaches 100% only when every requirement is met", () => {
    expect(completionPercent(complete)).toBe(100);
    expect(isProfileComplete(complete)).toBe(true);
  });

  it("refuses completion without a payout account", () => {
    const input = { ...complete, hasPayoutAccount: false };
    expect(isProfileComplete(input)).toBe(false);
    expect(completionPercent(input)).toBeLessThan(100);
  });

  it("refuses completion without availability", () => {
    expect(isProfileComplete({ ...complete, scheduleRuleCount: 0 })).toBe(false);
  });

  it("refuses completion without an offered service", () => {
    expect(isProfileComplete({ ...complete, enabledServiceCount: 0 })).toBe(false);
  });

  it("refuses a bio too short to tell a customer anything", () => {
    expect(isProfileComplete({ ...complete, bio: "Experienced." })).toBe(false);
  });

  it("names what is outstanding rather than only a number", () => {
    const outstanding = profileRequirements({ ...complete, profileImageUrl: null }).filter(
      (requirement) => !requirement.met,
    );

    expect(outstanding).toHaveLength(1);
    expect(outstanding[0].key).toBe("photo");
  });
});

/**
 * Money.
 *
 * The invariant worth protecting: the two halves of a split always sum back to
 * the gross. Rounding each independently would leave a stray paisa belonging to
 * nobody, which is the kind of error that only shows up in a reconciliation
 * months later.
 */
describe("earning split", () => {
  it("always sums back to the gross", () => {
    for (const gross of [1, 7, 99, 100, 333, 12_345, 99_999, 1_000_000]) {
      for (const percent of [0, 1, 7, 20, 33, 50, 90, 100]) {
        const split = splitEarning({ grossAmountPaise: gross, commissionPercent: percent });
        expect(split.platformCommissionPaise + split.netPayablePaise).toBe(gross);
      }
    }
  });

  it("uses integer paise throughout", () => {
    const split = splitEarning({ grossAmountPaise: 33_333, commissionPercent: 17 });
    expect(Number.isInteger(split.platformCommissionPaise)).toBe(true);
    expect(Number.isInteger(split.netPayablePaise)).toBe(true);
  });

  it("never emits a negative payable", () => {
    const split = splitEarning({
      grossAmountPaise: 10_000,
      commissionPercent: 20,
      adjustmentPaise: -1_000_000,
    });
    expect(split.netPayablePaise).toBe(0);
  });

  it("refuses a non-integer or negative gross", () => {
    expect(() => splitEarning({ grossAmountPaise: 10.5, commissionPercent: 20 })).toThrow();
    expect(() => splitEarning({ grossAmountPaise: -1, commissionPercent: 20 })).toThrow();
  });

  it("refuses a commission outside 0-100", () => {
    expect(() => splitEarning({ grossAmountPaise: 1000, commissionPercent: 101 })).toThrow();
    expect(() => splitEarning({ grossAmountPaise: 1000, commissionPercent: -1 })).toThrow();
  });
});

describe("payout transitions", () => {
  it("makes PAID terminal", () => {
    expect(PAYOUT_TRANSITIONS.PAID).toEqual([]);
    expect(canTransitionPayout("PAID", "PROCESSING")).toBe(false);
    expect(canTransitionPayout("PAID", "FAILED")).toBe(false);
  });

  it("refuses skipping straight to paid", () => {
    expect(canTransitionPayout("PENDING", "PAID")).toBe(false);
    expect(canTransitionPayout("ELIGIBLE", "PAID")).toBe(false);
  });

  it("allows retrying a failed transfer", () => {
    expect(canTransitionPayout("FAILED", "PROCESSING")).toBe(true);
  });

  it("allows holding and releasing", () => {
    expect(canTransitionPayout("ELIGIBLE", "HELD")).toBe(true);
    expect(canTransitionPayout("HELD", "ELIGIBLE")).toBe(true);
  });
});
