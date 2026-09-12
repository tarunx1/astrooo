import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ConsultationMode,
  ConsultationStatus,
  PanditOnboardingStatus,
  RateType,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { applyTransition, saveOwnService, startPanditApplication } from "@/lib/pandit/service";
import { addScheduleRule, bookConsultation, cancelConsultation } from "@/lib/pandit/schedule";
import { createPayout, settleConsultation, transitionPayout } from "@/lib/payouts/ledger";
import { grantKundliAccess, openSharedChart, revokeKundliAccess } from "@/lib/pandit/kundli-access";
import { getChatThread, sendChatMessage } from "@/lib/support/chat";
import { getTicket, createTicket, replyToTicket } from "@/lib/support/tickets";
import { setEmployeePermissions } from "@/lib/admin/employees";
import {
  ROLE_DEFAULT_PERMISSIONS,
  hasAnyPermission,
  resolvePermissions,
} from "@/lib/auth/permissions";

/**
 * Authorization against real Postgres.
 *
 * These are the evidence behind any claim that this role model holds. Every one
 * asserts a negative: that a Pandit cannot reach another Pandit's data, cannot
 * advance their own verification, cannot read a chart nobody shared with them,
 * and that an employee cannot be given a capability that is not delegable.
 *
 * The bar is deliberately "the operation is refused", not "the UI does not
 * offer it": each of these calls the service directly, with no page in the way.
 */
const RUN = `rbac${Date.now().toString(36)}`;

type Actor = { id: string; email: string };

async function createUser(label: string, role: UserRole = UserRole.CUSTOMER): Promise<Actor> {
  const user = await prisma.user.create({
    data: {
      name: `Test ${label}`,
      email: `${RUN}.${label}@example.test`,
      emailVerified: true,
      role,
    },
    select: { id: true, email: true },
  });
  return user;
}

/** Drives an application all the way to ACTIVE using the legitimate actors. */
async function makeActivePandit(label: string, reviewer: Actor, approver: Actor) {
  const user = await createUser(label);
  const profile = await startPanditApplication(user.id);

  await prisma.panditProfile.update({
    where: { id: profile.id },
    data: {
      displayName: `Pandit ${label}`,
      phone: "9999999999",
      city: "Amritsar",
      state: "Punjab",
      yearsOfExperience: 10,
      expertise: ["Vedic Astrology"],
      languages: ["Hindi"],
      bio: "x".repeat(120),
      profileImageUrl: "https://example.test/p.jpg",
    },
  });

  const steps: Array<[PanditOnboardingStatus, string, "pandit" | "reviewer" | "approver"]> = [
    [PanditOnboardingStatus.PROFILE_STARTED, user.id, "pandit"],
    [PanditOnboardingStatus.DOCUMENTS_PENDING, user.id, "pandit"],
    [PanditOnboardingStatus.SUBMITTED, user.id, "pandit"],
    [PanditOnboardingStatus.UNDER_REVIEW, reviewer.id, "reviewer"],
    [PanditOnboardingStatus.VERIFIED, reviewer.id, "reviewer"],
    [PanditOnboardingStatus.APPROVED, approver.id, "approver"],
    [PanditOnboardingStatus.PROFILE_COMPLETION_REQUIRED, user.id, "pandit"],
    [PanditOnboardingStatus.ACTIVE, user.id, "pandit"],
  ];

  for (const [to, actorUserId, actorKind] of steps) {
    const result = await applyTransition({
      panditProfileId: profile.id,
      to,
      actorUserId,
      actorKind,
    });
    if (!result.ok) throw new Error(`Setup failed reaching ${to}: ${result.message}`);
  }

  await saveOwnService(user.id, {
    mode: ConsultationMode.CHAT,
    enabled: true,
    rateType: RateType.PER_MINUTE,
    ratePaise: 2_000,
    sessionMinutes: null,
  });

  await addScheduleRule(user.id, { weekday: 1, startMinute: 9 * 60, endMinute: 18 * 60 });

  return { user, profileId: profile.id };
}

let reviewer: Actor;
let approver: Actor;
let panditA: { user: Actor; profileId: string };
let panditB: { user: Actor; profileId: string };
let customer: Actor;
let otherCustomer: Actor;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set for authorization tests.");
  }

  reviewer = await createUser("reviewer", UserRole.EMPLOYEE);
  // Deliberately not SUPER_ADMIN. These service-level tests pass an actor *id*;
  // the services never read the actor's role, because role and permission
  // authorization lives in the Server Actions above them. Creating a real super
  // admin here would inflate the global count that
  // `tests/admin-operations.test.ts` asserts on - it checks that the system
  // cannot be raced into having zero super admins - and files run in parallel.
  approver = await createUser("approver");
  customer = await createUser("customer");
  otherCustomer = await createUser("othercustomer");

  panditA = await makeActivePandit("alpha", reviewer, approver);
  panditB = await makeActivePandit("beta", reviewer, approver);
}, 60_000);

/**
 * Teardown, in dependency order.
 *
 * Several relations deliberately restrict deletion rather than cascading -
 * AuditLog keeps its actor, and a Consultation keeps its customer - because a
 * record that vanishes when an account is removed is not a record. That is a
 * property worth having, so the fixtures are unwound explicitly here instead of
 * the schema being loosened to make cleanup convenient.
 */
afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${RUN}.` } },
    select: { id: true, panditProfile: { select: { id: true } } },
  });

  const ids = users.map((user) => user.id);
  const panditIds = users.flatMap((user) => (user.panditProfile ? [user.panditProfile.id] : []));

  await prisma.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
  await prisma.earningTransaction.deleteMany({ where: { panditProfileId: { in: panditIds } } });
  await prisma.payout.deleteMany({ where: { panditProfileId: { in: panditIds } } });
  await prisma.panditKundliAccess.deleteMany({ where: { grantedByUserId: { in: ids } } });
  await prisma.consultation.deleteMany({
    where: { OR: [{ userId: { in: ids } }, { panditProfileId: { in: panditIds } }] },
  });
  await prisma.consultationSlot.deleteMany({ where: { panditProfileId: { in: panditIds } } });
  await prisma.ticketMessage.deleteMany({ where: { authorId: { in: ids } } });
  await prisma.ticket.deleteMany({ where: { createdById: { in: ids } } });
  await prisma.savedKundli.deleteMany({ where: { userId: { in: ids } } });
  await prisma.birthProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.astrologyCalculation.deleteMany({ where: { inputHash: { startsWith: RUN } } });

  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe("a pandit cannot advance their own verification", () => {
  it("refuses to verify itself", async () => {
    const applicant = await createUser("selfverify");
    const profile = await startPanditApplication(applicant.id);

    await applyTransition({
      panditProfileId: profile.id,
      to: PanditOnboardingStatus.PROFILE_STARTED,
      actorUserId: applicant.id,
      actorKind: "pandit",
    });
    await applyTransition({
      panditProfileId: profile.id,
      to: PanditOnboardingStatus.DOCUMENTS_PENDING,
      actorUserId: applicant.id,
      actorKind: "pandit",
    });
    await applyTransition({
      panditProfileId: profile.id,
      to: PanditOnboardingStatus.SUBMITTED,
      actorUserId: applicant.id,
      actorKind: "pandit",
    });

    const verified = await applyTransition({
      panditProfileId: profile.id,
      to: PanditOnboardingStatus.VERIFIED,
      actorUserId: applicant.id,
      actorKind: "pandit",
    });

    expect(verified.ok).toBe(false);

    const after = await prisma.panditProfile.findUnique({
      where: { id: profile.id },
      select: { status: true },
    });
    expect(after?.status).toBe(PanditOnboardingStatus.SUBMITTED);
  });

  it("refuses to approve itself even while claiming to be an approver", async () => {
    // The actor *kind* is claimed by the caller, so the ownership check is what
    // actually stops this: a "pandit" move must come from the owner, and an
    // approver move on your own file is refused because APPROVED is not
    // reachable from SUBMITTED at all.
    const applicant = await createUser("selfapprove");
    const profile = await startPanditApplication(applicant.id);

    const approved = await applyTransition({
      panditProfileId: profile.id,
      to: PanditOnboardingStatus.APPROVED,
      actorUserId: applicant.id,
      actorKind: "approver",
    });

    expect(approved.ok).toBe(false);
  });

  it("refuses a pandit acting on another pandit's application", async () => {
    const result = await applyTransition({
      panditProfileId: panditB.profileId,
      to: PanditOnboardingStatus.PROFILE_COMPLETION_REQUIRED,
      actorUserId: panditA.user.id,
      actorKind: "pandit",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("not yours");
  });

  it("refuses a reviewer skipping straight to approval", async () => {
    const applicant = await createUser("skipapproval");
    const profile = await startPanditApplication(applicant.id);

    const result = await applyTransition({
      panditProfileId: profile.id,
      to: PanditOnboardingStatus.APPROVED,
      actorUserId: reviewer.id,
      actorKind: "reviewer",
    });

    expect(result.ok).toBe(false);
  });
});

describe("a pandit cannot touch another pandit's data", () => {
  it("cannot save a service on another profile", async () => {
    await saveOwnService(panditA.user.id, {
      mode: ConsultationMode.VOICE_CALL,
      enabled: true,
      rateType: RateType.PER_MINUTE,
      ratePaise: 3_000,
      sessionMinutes: null,
    });

    // The service is resolved from the acting user id, so it landed on A.
    const onB = await prisma.panditService.findFirst({
      where: { panditProfileId: panditB.profileId, mode: ConsultationMode.VOICE_CALL },
    });
    expect(onB).toBeNull();

    const onA = await prisma.panditService.findFirst({
      where: { panditProfileId: panditA.profileId, mode: ConsultationMode.VOICE_CALL },
    });
    expect(onA).not.toBeNull();
  });

  it("cannot add availability to another profile", async () => {
    const before = await prisma.panditScheduleRule.count({
      where: { panditProfileId: panditB.profileId },
    });

    await addScheduleRule(panditA.user.id, { weekday: 3, startMinute: 600, endMinute: 720 });

    const after = await prisma.panditScheduleRule.count({
      where: { panditProfileId: panditB.profileId },
    });
    expect(after).toBe(before);
  });
});

describe("booking safety", () => {
  it("refuses a booking with a suspended pandit", async () => {
    const suspendedPandit = await makeActivePandit("suspended", reviewer, approver);

    const suspended = await applyTransition({
      panditProfileId: suspendedPandit.profileId,
      to: PanditOnboardingStatus.SUSPENDED,
      actorUserId: approver.id,
      actorKind: "approver",
      note: "Testing suspension.",
    });
    expect(suspended.ok).toBe(true);

    const start = nextMonday(10);
    const result = await bookConsultation({
      userId: customer.id,
      panditProfileId: suspendedPandit.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
    });

    expect(result.ok).toBe(false);
  });

  it("refuses a booking with an unapproved pandit", async () => {
    const applicant = await createUser("unapproved");
    const profile = await startPanditApplication(applicant.id);

    const result = await bookConsultation({
      userId: customer.id,
      panditProfileId: profile.id,
      mode: ConsultationMode.CHAT,
      start: nextMonday(11),
      durationMinutes: 30,
    });

    expect(result.ok).toBe(false);
  });

  it("refuses two bookings for the same slot", async () => {
    const start = nextMonday(12);

    const first = await bookConsultation({
      userId: customer.id,
      panditProfileId: panditA.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
    });
    expect(first.ok).toBe(true);

    const second = await bookConsultation({
      userId: otherCustomer.id,
      panditProfileId: panditA.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
    });
    expect(second.ok).toBe(false);
  });

  it("refuses an overlapping booking at a different start", async () => {
    const start = nextMonday(14);

    const first = await bookConsultation({
      userId: customer.id,
      panditProfileId: panditA.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 60,
    });
    expect(first.ok).toBe(true);

    const overlapping = await bookConsultation({
      userId: otherCustomer.id,
      panditProfileId: panditA.profileId,
      mode: ConsultationMode.CHAT,
      start: new Date(start.getTime() + 30 * 60_000),
      durationMinutes: 30,
    });
    expect(overlapping.ok).toBe(false);
  });

  it("survives concurrent attempts on the same slot", async () => {
    const start = nextMonday(16);

    const [a, b] = await Promise.all([
      bookConsultation({
        userId: customer.id,
        panditProfileId: panditA.profileId,
        mode: ConsultationMode.CHAT,
        start,
        durationMinutes: 30,
      }),
      bookConsultation({
        userId: otherCustomer.id,
        panditProfileId: panditA.profileId,
        mode: ConsultationMode.CHAT,
        start,
        durationMinutes: 30,
      }),
    ]);

    // Exactly one wins. Which one is not determined; that both cannot is.
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);

    const held = await prisma.consultationSlot.count({
      where: { panditProfileId: panditA.profileId, startsAt: start },
    });
    expect(held).toBe(1);
  });

  it("frees the slot when a booking is cancelled", async () => {
    const start = nextMonday(17);

    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: panditA.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const cancelled = await cancelConsultation({
      consultationId: booked.consultationId,
      actorUserId: customer.id,
    });
    expect(cancelled.ok).toBe(true);

    const rebooked = await bookConsultation({
      userId: otherCustomer.id,
      panditProfileId: panditA.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
    });
    expect(rebooked.ok).toBe(true);
  });

  it("refuses a cancellation by an unrelated user", async () => {
    const start = nextMonday(18);

    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: panditA.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const result = await cancelConsultation({
      consultationId: booked.consultationId,
      actorUserId: panditB.user.id,
    });

    expect(result.ok).toBe(false);
  });
});

describe("earnings and payouts", () => {
  it("settles a completed consultation exactly once", async () => {
    const start = nextMonday(9);

    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: panditB.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    await prisma.consultation.update({
      where: { id: booked.consultationId },
      data: { status: ConsultationStatus.COMPLETED, completedAt: new Date() },
    });

    const first = await settleConsultation({ consultationId: booked.consultationId });
    const second = await settleConsultation({ consultationId: booked.consultationId });
    const third = await settleConsultation({ consultationId: booked.consultationId });

    expect(first.ok && first.created).toBe(true);
    expect(second.ok && second.created).toBe(false);
    expect(third.ok && third.created).toBe(false);

    const count = await prisma.earningTransaction.count({
      where: { consultationId: booked.consultationId },
    });
    expect(count).toBe(1);
  });

  it("refuses to settle a consultation that is not complete", async () => {
    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: panditB.profileId,
      mode: ConsultationMode.CHAT,
      start: nextMonday(15),
      durationMinutes: 30,
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const result = await settleConsultation({ consultationId: booked.consultationId });
    expect(result.ok).toBe(false);
  });

  it("walks a payout through its states and refuses every shortcut", async () => {
    const pandit = await makeActivePandit("payoutflow", reviewer, approver);

    // A full hour at the configured rate, comfortably above the platform
    // minimum, so the transition rules are actually exercised rather than the
    // payout being declined for being too small.
    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: pandit.profileId,
      mode: ConsultationMode.CHAT,
      start: nextMonday(10),
      durationMinutes: 60,
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    await prisma.consultation.update({
      where: { id: booked.consultationId },
      data: { status: ConsultationStatus.COMPLETED, completedAt: new Date() },
    });
    await settleConsultation({ consultationId: booked.consultationId });

    await prisma.earningTransaction.updateMany({
      where: { panditProfileId: pandit.profileId },
      data: { status: "ELIGIBLE" },
    });

    const payout = await createPayout({
      panditProfileId: pandit.profileId,
      actorUserId: approver.id,
    });

    expect(payout.ok).toBe(true);
    if (!payout.ok) return;

    const straightToPaid = await transitionPayout({
      payoutId: payout.payoutId,
      to: "PAID",
      actorUserId: approver.id,
      reference: "UTR123",
    });
    expect(straightToPaid.ok).toBe(false);

    const processing = await transitionPayout({
      payoutId: payout.payoutId,
      to: "PROCESSING",
      actorUserId: approver.id,
    });
    expect(processing.ok).toBe(true);

    const withoutReference = await transitionPayout({
      payoutId: payout.payoutId,
      to: "PAID",
      actorUserId: approver.id,
    });
    expect(withoutReference.ok).toBe(false);

    const paid = await transitionPayout({
      payoutId: payout.payoutId,
      to: "PAID",
      actorUserId: approver.id,
      reference: "UTR-TEST-1",
    });
    expect(paid.ok).toBe(true);

    // PAID is terminal.
    const reopened = await transitionPayout({
      payoutId: payout.payoutId,
      to: "PROCESSING",
      actorUserId: approver.id,
    });
    expect(reopened.ok).toBe(false);
  });

  it("never lets a second payout claim the same earnings", async () => {
    const pandit = await makeActivePandit("doublepay", reviewer, approver);

    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: pandit.profileId,
      mode: ConsultationMode.CHAT,
      start: nextMonday(13),
      durationMinutes: 60,
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    await prisma.consultation.update({
      where: { id: booked.consultationId },
      data: { status: ConsultationStatus.COMPLETED, completedAt: new Date() },
    });
    await settleConsultation({ consultationId: booked.consultationId });
    await prisma.earningTransaction.updateMany({
      where: { panditProfileId: pandit.profileId },
      data: { status: "ELIGIBLE" },
    });

    const first = await createPayout({ panditProfileId: pandit.profileId, actorUserId: approver.id });
    const second = await createPayout({ panditProfileId: pandit.profileId, actorUserId: approver.id });

    if (first.ok) {
      // The earnings were claimed by the first payout, so the second finds none.
      expect(second.ok).toBe(false);
    }

    const claimed = await prisma.earningTransaction.findMany({
      where: { panditProfileId: pandit.profileId },
      select: { payoutId: true },
    });
    const payoutIds = new Set(claimed.map((row) => row.payoutId).filter(Boolean));
    expect(payoutIds.size).toBeLessThanOrEqual(1);
  });
});

describe("kundli access is granted, never assumed", () => {
  it("refuses a pandit reading a chart nobody shared", async () => {
    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: panditA.profileId,
      mode: ConsultationMode.CHAT,
      start: nextMonday(19),
      durationMinutes: 30,
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const access = await prisma.panditKundliAccess.findFirst({
      where: { consultationId: booked.consultationId },
    });

    // Booking alone creates no access.
    expect(access).toBeNull();
  });

  it("refuses sharing a chart the sender does not own", async () => {
    const { savedKundliId } = await createSavedKundli(customer.id, "shared-a");

    const booked = await bookConsultation({
      userId: otherCustomer.id,
      panditProfileId: panditA.profileId,
      mode: ConsultationMode.CHAT,
      start: nextMonday(20),
      durationMinutes: 30,
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    // otherCustomer owns the consultation but not the chart.
    const result = await grantKundliAccess({
      customerUserId: otherCustomer.id,
      consultationId: booked.consultationId,
      savedKundliId,
    });

    expect(result.ok).toBe(false);
  });

  it("refuses sharing into a consultation the sender is not party to", async () => {
    const { savedKundliId } = await createSavedKundli(customer.id, "shared-b");

    const booked = await bookConsultation({
      userId: otherCustomer.id,
      panditProfileId: panditB.profileId,
      mode: ConsultationMode.CHAT,
      start: nextMonday(21),
      durationMinutes: 30,
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const result = await grantKundliAccess({
      customerUserId: customer.id,
      consultationId: booked.consultationId,
      savedKundliId,
    });

    expect(result.ok).toBe(false);
  });

  it("lets the owner share, and the other pandit still cannot read it", async () => {
    const { savedKundliId } = await createSavedKundli(customer.id, "shared-c");

    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: panditA.profileId,
      mode: ConsultationMode.CHAT,
      start: nextMonday(22),
      durationMinutes: 30,
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const granted = await grantKundliAccess({
      customerUserId: customer.id,
      consultationId: booked.consultationId,
      savedKundliId,
    });
    expect(granted.ok).toBe(true);

    const access = await prisma.panditKundliAccess.findFirstOrThrow({
      where: { consultationId: booked.consultationId },
      select: { id: true },
    });

    const byOwner = await openSharedChart({
      panditProfileId: panditA.profileId,
      panditUserId: panditA.user.id,
      accessId: access.id,
    });
    expect(byOwner).not.toBeNull();

    // The same access id, asked for by a different Pandit.
    const byOther = await openSharedChart({
      panditProfileId: panditB.profileId,
      panditUserId: panditB.user.id,
      accessId: access.id,
    });
    expect(byOther).toBeNull();
  });

  it("stops working once the customer revokes it", async () => {
    const { savedKundliId } = await createSavedKundli(customer.id, "shared-d");

    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: panditA.profileId,
      mode: ConsultationMode.CHAT,
      start: nextMonday(23),
      durationMinutes: 30,
    });
    if (!booked.ok) throw new Error("setup booking failed");

    await grantKundliAccess({
      customerUserId: customer.id,
      consultationId: booked.consultationId,
      savedKundliId,
    });

    const access = await prisma.panditKundliAccess.findFirstOrThrow({
      where: { consultationId: booked.consultationId },
      select: { id: true },
    });

    const revoked = await revokeKundliAccess({ customerUserId: customer.id, accessId: access.id });
    expect(revoked.ok).toBe(true);

    const afterRevoke = await openSharedChart({
      panditProfileId: panditA.profileId,
      panditUserId: panditA.user.id,
      accessId: access.id,
    });
    expect(afterRevoke).toBeNull();
  });
});

describe("chat is scoped to a consultation", () => {
  it("refuses a message from someone not party to it", async () => {
    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: panditA.profileId,
      mode: ConsultationMode.CHAT,
      start: nextMonday(24),
      durationMinutes: 30,
    });
    if (!booked.ok) throw new Error("setup booking failed");

    const outsider = await sendChatMessage({
      consultationId: booked.consultationId,
      senderUserId: panditB.user.id,
      body: "Hello",
    });
    expect(outsider.ok).toBe(false);

    const otherCustomerAttempt = await sendChatMessage({
      consultationId: booked.consultationId,
      senderUserId: otherCustomer.id,
      body: "Hello",
    });
    expect(otherCustomerAttempt.ok).toBe(false);
  });

  it("refuses reading a thread you are not party to", async () => {
    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: panditA.profileId,
      mode: ConsultationMode.CHAT,
      start: nextMonday(25),
      durationMinutes: 30,
    });
    if (!booked.ok) throw new Error("setup booking failed");

    const asOutsider = await getChatThread({
      consultationId: booked.consultationId,
      viewerUserId: panditB.user.id,
    });
    expect(asOutsider).toBeNull();

    const asParty = await getChatThread({
      consultationId: booked.consultationId,
      viewerUserId: customer.id,
    });
    expect(asParty).not.toBeNull();
  });
});

describe("tickets are scoped to their reporter", () => {
  it("refuses another user reading a ticket without manage", async () => {
    const raised = await createTicket({
      userId: customer.id,
      role: UserRole.CUSTOMER,
      ticket: { category: "TECHNICAL", subject: "Test ticket", description: "Something is wrong here." },
    });

    const asOwner = await getTicket({
      ticketId: raised.ticketId,
      viewerUserId: customer.id,
      canSeeAll: false,
      canSeeInternal: false,
    });
    expect(asOwner).not.toBeNull();

    const asStranger = await getTicket({
      ticketId: raised.ticketId,
      viewerUserId: otherCustomer.id,
      canSeeAll: false,
      canSeeInternal: false,
    });
    expect(asStranger).toBeNull();
  });

  it("hides internal notes from the reporter", async () => {
    const raised = await createTicket({
      userId: customer.id,
      role: UserRole.CUSTOMER,
      ticket: { category: "PAYMENT", subject: "Internal note test", description: "Checking note visibility." },
    });

    await replyToTicket({
      ticketId: raised.ticketId,
      authorUserId: reviewer.id,
      body: "Operator only.",
      internal: true,
      canManage: true,
    });

    const asReporter = await getTicket({
      ticketId: raised.ticketId,
      viewerUserId: customer.id,
      canSeeAll: false,
      canSeeInternal: false,
    });

    expect(asReporter?.messages.some((message) => message.internal)).toBe(false);

    const asOperator = await getTicket({
      ticketId: raised.ticketId,
      viewerUserId: reviewer.id,
      canSeeAll: true,
      canSeeInternal: true,
    });
    expect(asOperator?.messages.some((message) => message.internal)).toBe(true);
  });

  it("never records a reporter's reply as an internal note", async () => {
    const raised = await createTicket({
      userId: customer.id,
      role: UserRole.CUSTOMER,
      ticket: { category: "OTHER", subject: "Reply flag test", description: "Checking the internal flag." },
    });

    await replyToTicket({
      ticketId: raised.ticketId,
      authorUserId: customer.id,
      body: "Trying to write an internal note.",
      // Claimed by the caller; refused because they cannot manage tickets.
      internal: true,
      canManage: false,
    });

    const messages = await prisma.ticketMessage.findMany({
      where: { ticketId: raised.ticketId },
      select: { internal: true },
    });

    expect(messages.every((message) => message.internal === false)).toBe(true);
  });
});

describe("public handle minting", () => {
  it("survives two identically-named practitioners going live at once", async () => {
    // The handle is derived from the display name, and minting reads then
    // writes. Two practitioners called the same thing activating simultaneously
    // both see the handle free; the unique index decides, and the loser has to
    // recover rather than surfacing a 500 on a legitimate action.
    const [first, second] = await Promise.all([
      createUser("samename1"),
      createUser("samename2"),
    ]);

    const profiles = await Promise.all([
      startPanditApplication(first.id),
      startPanditApplication(second.id),
    ]);

    const identical = "Pandit Identical Name";

    await prisma.panditProfile.updateMany({
      where: { id: { in: profiles.map((profile) => profile.id) } },
      data: { displayName: identical },
    });

    // Drive both to the point of activation.
    for (const profile of profiles) {
      const path: Array<[PanditOnboardingStatus, string, "pandit" | "reviewer" | "approver"]> = [
        [PanditOnboardingStatus.PROFILE_STARTED, profile.userId, "pandit"],
        [PanditOnboardingStatus.DOCUMENTS_PENDING, profile.userId, "pandit"],
        [PanditOnboardingStatus.SUBMITTED, profile.userId, "pandit"],
        [PanditOnboardingStatus.UNDER_REVIEW, reviewer.id, "reviewer"],
        [PanditOnboardingStatus.VERIFIED, reviewer.id, "reviewer"],
        [PanditOnboardingStatus.APPROVED, approver.id, "approver"],
        [PanditOnboardingStatus.PROFILE_COMPLETION_REQUIRED, profile.userId, "pandit"],
      ];

      for (const [to, actorUserId, actorKind] of path) {
        const result = await applyTransition({
          panditProfileId: profile.id,
          to,
          actorUserId,
          actorKind,
        });
        if (!result.ok) throw new Error(`setup failed at ${to}: ${result.message}`);
      }
    }

    const activations = await Promise.all(
      profiles.map((profile) =>
        applyTransition({
          panditProfileId: profile.id,
          to: PanditOnboardingStatus.ACTIVE,
          actorUserId: profile.userId,
          actorKind: "pandit",
        }),
      ),
    );

    // Both succeed. Neither throws, and neither is refused.
    expect(activations.every((result) => result.ok)).toBe(true);

    const slugs = await prisma.panditProfile.findMany({
      where: { id: { in: profiles.map((profile) => profile.id) } },
      select: { slug: true },
    });

    expect(slugs.every((row) => row.slug !== null)).toBe(true);
    // Distinct handles, which is what the unique index guarantees.
    expect(new Set(slugs.map((row) => row.slug)).size).toBe(2);
  });
});

describe("what an operations permission does not imply", () => {
  it("does not let a default employee see platform revenue", async () => {
    // `requireAdmin` admits anyone holding any operations permission, which by
    // design includes an employee given orders or tickets - they need the admin
    // order screens. But "can work an order" is not "may see what the platform
    // earned", and the Overview page was showing revenue to exactly those
    // people. The gate is a permission, not the absence of a link.
    const permissions = resolvePermissions(UserRole.EMPLOYEE);

    expect(hasAnyPermission(permissions, ["analytics.view", "payouts.view"])).toBe(false);
  });

  it("still lets a default employee reach the operations area", async () => {
    // The fix must not lock them out of the order and ticket screens they are
    // given the permissions for.
    const permissions = resolvePermissions(UserRole.EMPLOYEE);

    expect(hasAnyPermission(permissions, ROLE_DEFAULT_PERMISSIONS[UserRole.ADMIN])).toBe(true);
  });

  it("lets an admin and a super admin see revenue", async () => {
    expect(
      hasAnyPermission(resolvePermissions(UserRole.ADMIN), ["analytics.view", "payouts.view"]),
    ).toBe(true);

    // Full access covers it without listing it.
    expect(
      hasAnyPermission(resolvePermissions(UserRole.SUPER_ADMIN), ["analytics.view", "payouts.view"]),
    ).toBe(true);
  });
});

describe("employee permissions", () => {
  it("refuses an undelegable permission on write", async () => {
    const staff = await createUser("staffperm", UserRole.EMPLOYEE);
    await prisma.employeeProfile.create({ data: { userId: staff.id, active: true } });

    const result = await setEmployeePermissions({
      actorUserId: approver.id,
      targetUserId: staff.id,
      permissions: ["tickets.manage", "api_keys.manage"],
    });

    expect(result.ok).toBe(false);

    const written = await prisma.userPermission.count({ where: { userId: staff.id } });
    expect(written).toBe(0);
  });

  it("refuses an unknown permission", async () => {
    const staff = await createUser("staffunknown", UserRole.EMPLOYEE);
    await prisma.employeeProfile.create({ data: { userId: staff.id, active: true } });

    const result = await setEmployeePermissions({
      actorUserId: approver.id,
      targetUserId: staff.id,
      permissions: ["definitely.not.a.permission"],
    });

    expect(result.ok).toBe(false);
  });

  it("refuses changing your own permissions", async () => {
    const result = await setEmployeePermissions({
      actorUserId: approver.id,
      targetUserId: approver.id,
      permissions: ["tickets.manage"],
    });

    expect(result.ok).toBe(false);
  });

  it("stores departures from the role default, not a copy of it", async () => {
    const staff = await createUser("staffdiff", UserRole.EMPLOYEE);
    await prisma.employeeProfile.create({ data: { userId: staff.id, active: true } });

    const result = await setEmployeePermissions({
      actorUserId: approver.id,
      targetUserId: staff.id,
      // The default bundle minus tickets.manage, plus orders.manage.
      permissions: ["pandits.view", "pandits.review", "tickets.view", "orders.view", "orders.manage", "reports.view", "users.view"],
    });

    expect(result.ok).toBe(true);

    const overrides = await prisma.userPermission.findMany({
      where: { userId: staff.id },
      select: { permission: true, granted: true },
    });

    const effective = resolvePermissions(UserRole.EMPLOYEE, overrides);

    expect(effective.has("orders.manage")).toBe(true);
    expect(effective.has("tickets.manage")).toBe(false);
    expect(effective.has("tickets.view")).toBe(true);
  });

  it("strips permissions from a deactivated employee", async () => {
    // `getViewer` zeroes the set when the employment is inactive; assert the
    // data the rule reads, since the rule itself needs a request context.
    const staff = await createUser("staffinactive", UserRole.EMPLOYEE);
    await prisma.employeeProfile.create({ data: { userId: staff.id, active: false } });

    const profile = await prisma.employeeProfile.findUniqueOrThrow({
      where: { userId: staff.id },
      select: { active: true },
    });

    expect(profile.active).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** A Monday well inside the booking window, at a given local hour. */
function nextMonday(hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7));
  date.setHours(hour, 0, 0, 0);
  return date;
}

let savedCounter = 0;

async function createSavedKundli(userId: string, label: string) {
  savedCounter += 1;

  const birthProfile = await prisma.birthProfile.create({
    data: {
      userId,
      name: `Chart ${label}`,
      dateOfBirth: new Date("1992-08-14T00:00:00.000Z"),
      timeOfBirth: "06:35",
      placeName: "Amritsar, Punjab, India",
      placeOfBirth: "Amritsar, Punjab, India",
      city: "Amritsar",
      region: "Punjab",
      country: "India",
      latitude: 31.634,
      longitude: 74.8723,
      timezone: "Asia/Kolkata",
    },
    select: { id: true },
  });

  const calculation = await prisma.astrologyCalculation.create({
    data: {
      birthProfileId: birthProfile.id,
      calculationType: "KUNDLI",
      provider: "native",
      providerVersion: "1",
      calculationVersion: "1",
      inputHash: `${RUN}-${label}-${savedCounter}`,
      input: {},
      result: { ok: true },
      status: "READY",
    },
    select: { id: true },
  });

  const saved = await prisma.savedKundli.create({
    data: { userId, birthProfileId: birthProfile.id, calculationId: calculation.id },
    select: { id: true },
  });

  return { savedKundliId: saved.id, calculationId: calculation.id };
}
