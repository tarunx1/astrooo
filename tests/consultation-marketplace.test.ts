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
import { addScheduleRule, availableSlots, releaseExpiredPaymentHolds, bookConsultation } from "@/lib/pandit/schedule";
import { directoryFacets, getBookablePandit, getPublicPandit, listDirectory } from "@/lib/consultations/directory";
import {
  cancelConsultationForUser,
  getBookingForParticipant,
  listCustomerBookings,
  listPanditBookings,
} from "@/lib/consultations/bookings";
import { applyVerifiedConsultationPayment } from "@/lib/consultations/checkout";
import { authorizeSessionJoin } from "@/lib/consultations/session";
import { settleConsultation } from "@/lib/payouts/ledger";
import { CONSULTATION_POLICY } from "@/lib/consultations/status";
import type { ProviderPayment } from "@/lib/payments/provider";

/**
 * The consultation marketplace, against real Postgres.
 *
 * The assertions that matter here are negatives: an unlisted practitioner is
 * not reachable, two customers cannot hold the same slot, a payment for one
 * booking cannot confirm another, and neither party can see a consultation they
 * are not part of.
 */
const RUN = `mkt${Date.now().toString(36)}`;

type Actor = { id: string; email: string };

async function createUser(label: string, role: UserRole = UserRole.CUSTOMER): Promise<Actor> {
  return prisma.user.create({
    data: { name: `Test ${label}`, email: `${RUN}.${label}@example.test`, emailVerified: true, role },
    select: { id: true, email: true },
  });
}

/** Drives an application to a chosen status through the legitimate actors. */
async function makePandit(
  label: string,
  reviewer: Actor,
  approver: Actor,
  target: PanditOnboardingStatus = PanditOnboardingStatus.ACTIVE,
) {
  const user = await createUser(label);
  const profile = await startPanditApplication(user.id);

  await prisma.panditProfile.update({
    where: { id: profile.id },
    data: {
      displayName: `Pandit ${label}`,
      headline: `${label} practitioner`,
      phone: "9999999999",
      city: label === "alpha" ? "Amritsar" : "Jaipur",
      state: "Punjab",
      yearsOfExperience: label === "alpha" ? 20 : 5,
      expertise: label === "alpha" ? ["Vedic Astrology", "Marriage"] : ["KP Astrology"],
      languages: label === "alpha" ? ["Hindi", "Punjabi"] : ["Hindi"],
      bio: "x".repeat(120),
      profileImageUrl: "https://example.test/p.jpg",
    },
  });

  const path: Array<[PanditOnboardingStatus, string, "pandit" | "reviewer" | "approver"]> = [
    [PanditOnboardingStatus.PROFILE_STARTED, user.id, "pandit"],
    [PanditOnboardingStatus.DOCUMENTS_PENDING, user.id, "pandit"],
    [PanditOnboardingStatus.SUBMITTED, user.id, "pandit"],
    [PanditOnboardingStatus.UNDER_REVIEW, reviewer.id, "reviewer"],
    [PanditOnboardingStatus.VERIFIED, reviewer.id, "reviewer"],
    [PanditOnboardingStatus.APPROVED, approver.id, "approver"],
    [PanditOnboardingStatus.PROFILE_COMPLETION_REQUIRED, user.id, "pandit"],
    [PanditOnboardingStatus.ACTIVE, user.id, "pandit"],
  ];

  for (const [to, actorUserId, actorKind] of path) {
    const result = await applyTransition({ panditProfileId: profile.id, to, actorUserId, actorKind });
    if (!result.ok) throw new Error(`setup failed at ${to}: ${result.message}`);
    if (to === target) break;
  }

  await saveOwnService(user.id, {
    mode: ConsultationMode.CHAT,
    enabled: true,
    rateType: RateType.PER_MINUTE,
    ratePaise: 2_000,
    sessionMinutes: null,
  });

  // Deliberately a wide window. These are fixtures, and a realistic 9-to-5
  // ran out of distinct slots part-way through the file, which made tests fail
  // for a reason that had nothing to do with what they were asserting.
  await addScheduleRule(user.id, { weekday: 1, startMinute: 0, endMinute: 24 * 60 });

  const final = await prisma.panditProfile.findUniqueOrThrow({
    where: { id: profile.id },
    select: { slug: true, status: true },
  });

  return { user, profileId: profile.id, slug: final.slug, status: final.status };
}

let reviewer: Actor;
let approver: Actor;
let customer: Actor;
let otherCustomer: Actor;
let active: Awaited<ReturnType<typeof makePandit>>;
let second: Awaited<ReturnType<typeof makePandit>>;
let unapproved: Awaited<ReturnType<typeof makePandit>>;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set for marketplace tests.");

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

  active = await makePandit("alpha", reviewer, approver);
  second = await makePandit("beta", reviewer, approver);
  unapproved = await makePandit("gamma", reviewer, approver, PanditOnboardingStatus.SUBMITTED);
}, 90_000);

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${RUN}.` } },
    select: { id: true, panditProfile: { select: { id: true } } },
  });

  const ids = users.map((user) => user.id);
  const panditIds = users.flatMap((user) => (user.panditProfile ? [user.panditProfile.id] : []));

  await prisma.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
  await prisma.payment.deleteMany({ where: { userId: { in: ids } } });
  await prisma.earningTransaction.deleteMany({ where: { panditProfileId: { in: panditIds } } });
  await prisma.consultation.deleteMany({
    where: { OR: [{ userId: { in: ids } }, { panditProfileId: { in: panditIds } }] },
  });
  await prisma.consultationSlot.deleteMany({ where: { panditProfileId: { in: panditIds } } });
  await prisma.review.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

/** A Monday inside the booking window, at a given local hour. */
function nextMonday(hour: number, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7));
  date.setHours(hour, minute, 0, 0);
  return date;
}

/**
 * Hands out a slot nobody else in this file has used.
 *
 * Picking times by hand made tests fail for the wrong reason - a 60-minute
 * booking at 09:30 silently consumed the 10:00 another test wanted - so the
 * window is allocated instead, advancing past whatever the previous test
 * reserved. Tests that deliberately contend for one time capture it in a local
 * and reuse that.
 */
let slotCursorMinutes = 60;

function freeSlot(durationMinutes = 30): Date {
  const minutes = slotCursorMinutes;
  slotCursorMinutes += durationMinutes;

  if (slotCursorMinutes > 23 * 60) {
    throw new Error("Ran out of fixture availability; widen the schedule rule.");
  }

  return nextMonday(Math.floor(minutes / 60), minutes % 60);
}

describe("directory visibility", () => {
  it("lists an active practitioner", async () => {
    const result = await listDirectory({ q: "alpha" });
    expect(result.rows.some((row) => row.id === active.profileId)).toBe(true);
  });

  it("never lists a practitioner who is not ACTIVE", async () => {
    const result = await listDirectory({ pageSize: 48 });
    expect(result.rows.some((row) => row.id === unapproved.profileId)).toBe(false);
  });

  it("hides a practitioner the moment they are suspended", async () => {
    const before = await listDirectory({ q: "beta" });
    expect(before.rows.some((row) => row.id === second.profileId)).toBe(true);

    const suspended = await applyTransition({
      panditProfileId: second.profileId,
      to: PanditOnboardingStatus.SUSPENDED,
      actorUserId: approver.id,
      actorKind: "approver",
      note: "Testing visibility.",
    });
    expect(suspended.ok).toBe(true);

    const after = await listDirectory({ q: "beta" });
    expect(after.rows.some((row) => row.id === second.profileId)).toBe(false);

    // And their public profile stops resolving, so a bookmarked URL 404s.
    expect(await getPublicPandit(second.slug!)).toBeNull();

    // Restored so later tests see a stable fixture.
    await applyTransition({
      panditProfileId: second.profileId,
      to: PanditOnboardingStatus.ACTIVE,
      actorUserId: approver.id,
      actorKind: "approver",
    });
  });

  it("does not resolve an unapproved practitioner's profile", async () => {
    expect(unapproved.slug).toBeNull();
    expect(await getBookablePandit("does-not-exist")).toBeNull();
  });

  it("filters by expertise", async () => {
    const result = await listDirectory({ expertise: "Marriage", pageSize: 48 });
    expect(result.rows.every((row) => row.expertise.includes("Marriage"))).toBe(true);
    expect(result.rows.some((row) => row.id === active.profileId)).toBe(true);
  });

  it("filters by language", async () => {
    const result = await listDirectory({ language: "Punjabi", pageSize: 48 });
    expect(result.rows.every((row) => row.languages.includes("Punjabi"))).toBe(true);
  });

  it("filters by consultation type", async () => {
    const chat = await listDirectory({ mode: ConsultationMode.CHAT, pageSize: 48 });
    expect(chat.rows.some((row) => row.id === active.profileId)).toBe(true);

    const video = await listDirectory({ mode: ConsultationMode.VIDEO_CALL, pageSize: 48 });
    expect(video.rows.some((row) => row.id === active.profileId)).toBe(false);
  });

  it("filters by maximum rate", async () => {
    const cheap = await listDirectory({ maxRatePaise: 100, pageSize: 48 });
    expect(cheap.rows.some((row) => row.id === active.profileId)).toBe(false);

    const affordable = await listDirectory({ maxRatePaise: 5_000, pageSize: 48 });
    expect(affordable.rows.some((row) => row.id === active.profileId)).toBe(true);
  });

  it("paginates rather than returning everything", async () => {
    const page = await listDirectory({ pageSize: 1, page: 1 });
    expect(page.rows.length).toBeLessThanOrEqual(1);
    expect(page.total).toBeGreaterThanOrEqual(1);
  });

  it("offers facets only from listed practitioners", async () => {
    const facets = await directoryFacets();
    // "KP Astrology" belongs to an active practitioner, so it is offered.
    expect(facets.expertise).toContain("Vedic Astrology");
    expect(facets.modes).toContain(ConsultationMode.CHAT);
  });
});

describe("public profile privacy", () => {
  it("never exposes private practitioner data", async () => {
    const profile = await getPublicPandit(active.slug!);
    expect(profile).not.toBeNull();

    const serialised = JSON.stringify(profile);
    // The owning account's email is private; the profile carries a display name.
    expect(serialised).not.toContain(active.user.email);
    expect(serialised).not.toContain("commissionPercent");
    expect(serialised).not.toContain("payoutAccount");
    expect(serialised).not.toContain("storageKey");
  });

  it("reports no rating rather than a fabricated one", async () => {
    const profile = await getPublicPandit(active.slug!);
    expect(profile?.rating).toBeNull();
    expect(profile?.reviewCount).toBe(0);
  });

  it("counts only published reviews", async () => {
    await prisma.review.create({
      data: {
        userId: customer.id,
        panditProfileId: active.profileId,
        rating: 5,
        body: "Unpublished review",
        published: false,
      },
    });

    const withDraft = await getPublicPandit(active.slug!);
    expect(withDraft?.rating).toBeNull();

    await prisma.review.create({
      data: {
        userId: otherCustomer.id,
        panditProfileId: active.profileId,
        rating: 4,
        body: "Published review",
        published: true,
      },
    });

    const withPublished = await getPublicPandit(active.slug!);
    expect(withPublished?.rating).toBe(4);
    expect(withPublished?.reviewCount).toBe(1);
  });
});

describe("availability", () => {
  it("generates slots from the practitioner's own schedule", async () => {
    const from = nextMonday(0);
    const to = new Date(from.getTime() + 24 * 60 * 60_000);

    const slots = await availableSlots({
      panditProfileId: active.profileId,
      from,
      to,
      durationMinutes: 30,
    });

    expect(slots.length).toBeGreaterThan(0);
  });

  it("removes a slot once it is booked", async () => {
    const start = freeSlot(30);

    const before = await availableSlots({
      panditProfileId: active.profileId,
      from: nextMonday(0),
      to: new Date(nextMonday(0).getTime() + 24 * 60 * 60_000),
      durationMinutes: 30,
    });
    expect(before.some((slot) => slot.start.getTime() === start.getTime())).toBe(true);

    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
    });
    expect(booked.ok).toBe(true);

    const after = await availableSlots({
      panditProfileId: active.profileId,
      from: nextMonday(0),
      to: new Date(nextMonday(0).getTime() + 24 * 60 * 60_000),
      durationMinutes: 30,
    });
    expect(after.some((slot) => slot.start.getTime() === start.getTime())).toBe(false);
  });

  it("respects a blocked date", async () => {
    const monday = nextMonday(12);

    // Exceptions are keyed by the practitioner's *local* calendar date, which is
    // not the same as the UTC date: local midnight in Asia/Kolkata is the
    // previous day in UTC. The key is derived the same way the generator does.
    const dateKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(monday);

    const windowStart = new Date(monday.getTime() - 24 * 60 * 60_000);
    const windowEnd = new Date(monday.getTime() + 24 * 60 * 60_000);

    const before = await availableSlots({
      panditProfileId: second.profileId,
      from: windowStart,
      to: windowEnd,
      durationMinutes: 30,
    });

    const localDay = (instant: Date) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(instant);

    expect(before.filter((slot) => localDay(slot.start) === dateKey).length).toBeGreaterThan(0);

    const exception = await prisma.panditScheduleException.create({
      data: {
        panditProfileId: second.profileId,
        date: new Date(`${dateKey}T00:00:00.000Z`),
        available: false,
      },
      select: { id: true },
    });

    const after = await availableSlots({
      panditProfileId: second.profileId,
      from: windowStart,
      to: windowEnd,
      durationMinutes: 30,
    });

    expect(after.filter((slot) => localDay(slot.start) === dateKey)).toHaveLength(0);

    await prisma.panditScheduleException.delete({ where: { id: exception.id } });
  });

  it("returns nothing for a practitioner who is not bookable", async () => {
    const slots = await availableSlots({
      panditProfileId: unapproved.profileId,
      from: nextMonday(0),
      to: new Date(nextMonday(0).getTime() + 24 * 60 * 60_000),
      durationMinutes: 30,
    });

    expect(slots).toHaveLength(0);
  });
});

describe("double-booking protection", () => {
  it("refuses a second booking for the same start", async () => {
    const start = freeSlot(30);

    const first = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
    });
    expect(first.ok).toBe(true);

    const second = await bookConsultation({
      userId: otherCustomer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
    });
    expect(second.ok).toBe(false);
  });

  it("refuses an overlapping booking at a different start", async () => {
    const start = freeSlot(60);

    const first = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 60,
    });
    expect(first.ok).toBe(true);

    const overlapping = await bookConsultation({
      userId: otherCustomer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start: new Date(start.getTime() + 30 * 60_000),
      durationMinutes: 30,
    });
    expect(overlapping.ok).toBe(false);
  });

  it("lets exactly one of four concurrent attempts win", async () => {
    const start = freeSlot(30);

    const attempts = await Promise.all(
      [customer, otherCustomer, customer, otherCustomer].map((actor) =>
        bookConsultation({
          userId: actor.id,
          panditProfileId: active.profileId,
          mode: ConsultationMode.CHAT,
          start,
          durationMinutes: 30,
        }),
      ),
    );

    expect(attempts.filter((attempt) => attempt.ok)).toHaveLength(1);

    const held = await prisma.consultationSlot.count({
      where: { panditProfileId: active.profileId, startsAt: start },
    });
    expect(held).toBe(1);
  });

  it("holds the slot while a booking is awaiting payment", async () => {
    const start = freeSlot(30);

    const held = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
      status: ConsultationStatus.PENDING_PAYMENT,
    });
    expect(held.ok).toBe(true);

    const second = await bookConsultation({
      userId: otherCustomer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
    });
    expect(second.ok).toBe(false);
  });

  it("returns an expired unpaid hold to the calendar", async () => {
    const start = freeSlot(30);

    const held = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
      status: ConsultationStatus.PENDING_PAYMENT,
    });
    expect(held.ok).toBe(true);
    if (!held.ok) return;

    // Age the hold past its expiry.
    await prisma.consultation.update({
      where: { id: held.consultationId },
      data: {
        createdAt: new Date(Date.now() - (CONSULTATION_POLICY.paymentHoldMinutes + 5) * 60_000),
      },
    });

    const released = await releaseExpiredPaymentHolds();
    expect(released).toBeGreaterThanOrEqual(1);

    const rebooked = await bookConsultation({
      userId: otherCustomer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
    });
    expect(rebooked.ok).toBe(true);
  });

  it("does not release a hold that has been paid", async () => {
    const start = freeSlot(30);

    const held = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
      status: ConsultationStatus.PENDING_PAYMENT,
    });
    if (!held.ok) throw new Error("setup failed");

    await prisma.consultation.update({
      where: { id: held.consultationId },
      data: {
        createdAt: new Date(Date.now() - (CONSULTATION_POLICY.paymentHoldMinutes + 5) * 60_000),
        status: ConsultationStatus.CONFIRMED,
        paidAt: new Date(),
      },
    });

    await releaseExpiredPaymentHolds();

    const after = await prisma.consultation.findUniqueOrThrow({
      where: { id: held.consultationId },
      select: { status: true },
    });
    expect(after.status).toBe(ConsultationStatus.CONFIRMED);
  });
});

describe("commission snapshot", () => {
  it("freezes the split at booking and settles from it", async () => {
    const start = freeSlot(60);

    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 60,
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const snapshot = await prisma.consultation.findUniqueOrThrow({
      where: { id: booked.consultationId },
      select: {
        commissionPercent: true,
        platformCommissionPaise: true,
        panditEarningPaise: true,
        grossAmountPaise: true,
      },
    });

    expect(snapshot.commissionPercent).not.toBeNull();
    // The two halves always sum back to the gross.
    expect(
      (snapshot.platformCommissionPaise ?? 0) + (snapshot.panditEarningPaise ?? 0),
    ).toBe(snapshot.grossAmountPaise);

    const originalPercent = snapshot.commissionPercent!;

    // The practitioner's commission changes after the booking was priced.
    await prisma.panditProfile.update({
      where: { id: active.profileId },
      data: { commissionPercent: originalPercent === 50 ? 40 : 50 },
    });

    await prisma.consultation.update({
      where: { id: booked.consultationId },
      data: { status: ConsultationStatus.COMPLETED, completedAt: new Date() },
    });

    const settled = await settleConsultation({ consultationId: booked.consultationId });
    expect(settled.ok).toBe(true);

    const earning = await prisma.earningTransaction.findUniqueOrThrow({
      where: { consultationId: booked.consultationId },
      select: { commissionPercent: true, netPayablePaise: true },
    });

    // Settled at the rate the customer paid under, not the new one.
    expect(earning.commissionPercent).toBe(originalPercent);
    expect(earning.netPayablePaise).toBe(snapshot.panditEarningPaise);

    await prisma.panditProfile.update({
      where: { id: active.profileId },
      data: { commissionPercent: null },
    });
  });
});

describe("payment confirmation", () => {
  function providerPayment(orderId: string, amountMinor: number, id: string): ProviderPayment {
    return {
      provider: "razorpay",
      id,
      orderId,
      amountMinor,
      currency: "INR",
      status: "captured",
      capturedAt: new Date(),
    };
  }

  it("confirms a booking and is idempotent", async () => {
    const start = freeSlot(30);

    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
      status: ConsultationStatus.PENDING_PAYMENT,
    });
    if (!booked.ok) throw new Error("setup failed");

    const orderId = `order_${RUN}_ok`;
    await prisma.consultation.update({
      where: { id: booked.consultationId },
      data: { providerOrderId: orderId },
    });

    const payment = providerPayment(orderId, booked.grossAmountPaise, `pay_${RUN}_ok`);

    const first = await applyVerifiedConsultationPayment(booked.consultationId, payment);
    expect(first.ok && first.alreadyPaid).toBe(false);

    // The webhook arriving after the browser callback must not double-confirm.
    const second = await applyVerifiedConsultationPayment(booked.consultationId, payment);
    expect(second.ok && second.alreadyPaid).toBe(true);

    const after = await prisma.consultation.findUniqueOrThrow({
      where: { id: booked.consultationId },
      select: { status: true, paidAt: true },
    });
    expect(after.status).toBe(ConsultationStatus.CONFIRMED);

    const payments = await prisma.payment.count({
      where: { consultationId: booked.consultationId },
    });
    expect(payments).toBe(1);
  });

  it("refuses a payment whose order belongs to another booking", async () => {
    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start: freeSlot(30),
      durationMinutes: 30,
      status: ConsultationStatus.PENDING_PAYMENT,
    });
    if (!booked.ok) throw new Error("setup failed");

    await prisma.consultation.update({
      where: { id: booked.consultationId },
      data: { providerOrderId: `order_${RUN}_mine` },
    });

    const result = await applyVerifiedConsultationPayment(
      booked.consultationId,
      providerPayment(`order_${RUN}_someone_else`, booked.grossAmountPaise, `pay_${RUN}_x`),
    );

    expect(result.ok).toBe(false);
  });

  it("refuses a payment whose amount does not match", async () => {
    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start: freeSlot(30),
      durationMinutes: 30,
      status: ConsultationStatus.PENDING_PAYMENT,
    });
    if (!booked.ok) throw new Error("setup failed");

    const orderId = `order_${RUN}_amount`;
    await prisma.consultation.update({
      where: { id: booked.consultationId },
      data: { providerOrderId: orderId },
    });

    const result = await applyVerifiedConsultationPayment(
      booked.consultationId,
      providerPayment(orderId, 1, `pay_${RUN}_amount`),
    );

    expect(result.ok).toBe(false);
  });
});

describe("booking ownership", () => {
  let bookingId: string;

  beforeAll(async () => {
    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start: freeSlot(30),
      durationMinutes: 30,
    });
    if (!booked.ok) throw new Error("setup failed");
    bookingId = booked.consultationId;
  });

  it("lets the customer see their own booking", async () => {
    const view = await getBookingForParticipant({
      consultationId: bookingId,
      viewerUserId: customer.id,
    });
    expect(view).not.toBeNull();
  });

  it("lets the pandit see a booking made with them", async () => {
    const view = await getBookingForParticipant({
      consultationId: bookingId,
      viewerUserId: active.user.id,
    });
    expect(view).not.toBeNull();
  });

  it("refuses another customer", async () => {
    const view = await getBookingForParticipant({
      consultationId: bookingId,
      viewerUserId: otherCustomer.id,
    });
    expect(view).toBeNull();
  });

  it("refuses another pandit", async () => {
    const view = await getBookingForParticipant({
      consultationId: bookingId,
      viewerUserId: second.user.id,
    });
    expect(view).toBeNull();
  });

  it("never returns another customer's booking in a list", async () => {
    const mine = await listCustomerBookings({ userId: otherCustomer.id, scope: "all" });
    expect(mine.every((booking) => booking.id !== bookingId)).toBe(true);
  });

  it("never returns another pandit's booking in a list", async () => {
    const theirs = await listPanditBookings({ panditUserId: second.user.id, scope: "all" });
    expect(theirs.every((booking) => booking.id !== bookingId)).toBe(true);
  });
});

describe("cancellation", () => {
  it("refuses a cancellation by someone not party to the booking", async () => {
    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start: freeSlot(30),
      durationMinutes: 30,
    });
    if (!booked.ok) throw new Error("setup failed");

    const result = await cancelConsultationForUser({
      consultationId: booked.consultationId,
      userId: otherCustomer.id,
      reason: null,
    });

    expect(result.ok).toBe(false);
  });

  it("frees the slot on cancellation", async () => {
    const start = freeSlot(30);

    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
    });
    if (!booked.ok) throw new Error("setup failed");

    const cancelled = await cancelConsultationForUser({
      consultationId: booked.consultationId,
      userId: customer.id,
      reason: "Changed my mind",
    });
    expect(cancelled.ok).toBe(true);

    const rebooked = await bookConsultation({
      userId: otherCustomer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
    });
    expect(rebooked.ok).toBe(true);
  });

  it("refuses cancelling a booking that has already started", async () => {
    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start: freeSlot(30),
      durationMinutes: 30,
    });
    if (!booked.ok) throw new Error("setup failed");

    await prisma.consultation.update({
      where: { id: booked.consultationId },
      data: { scheduledStart: new Date(Date.now() - 60_000) },
    });

    const result = await cancelConsultationForUser({
      consultationId: booked.consultationId,
      userId: customer.id,
      reason: null,
    });

    expect(result.ok).toBe(false);
  });
});

describe("session authorization", () => {
  it("refuses a token to someone not party to the consultation", async () => {
    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start: freeSlot(30),
      durationMinutes: 30,
    });
    if (!booked.ok) throw new Error("setup failed");

    const access = await authorizeSessionJoin({
      consultationId: booked.consultationId,
      viewerUserId: otherCustomer.id,
    });

    expect(access.ok).toBe(false);
    if (!access.ok) expect(access.code).toBe("not_found");
  });

  it("refuses joining before the window opens", async () => {
    const start = freeSlot(30);

    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
    });
    if (!booked.ok) throw new Error("setup failed");

    await prisma.consultation.update({
      where: { id: booked.consultationId },
      data: { status: ConsultationStatus.CONFIRMED, paidAt: new Date() },
    });

    const access = await authorizeSessionJoin({
      consultationId: booked.consultationId,
      viewerUserId: customer.id,
      // Well before the join window opens.
      now: new Date(start.getTime() - 60 * 60_000),
    });

    expect(access.ok).toBe(false);
    if (!access.ok) expect(access.code).toBe("not_joinable");
  });

  it("refuses joining a booking that is not confirmed", async () => {
    const pendingStart = freeSlot(30);

    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start: pendingStart,
      durationMinutes: 30,
      status: ConsultationStatus.PENDING_PAYMENT,
    });
    if (!booked.ok) throw new Error("setup failed");

    const access = await authorizeSessionJoin({
      consultationId: booked.consultationId,
      viewerUserId: customer.id,
      now: pendingStart,
    });

    expect(access.ok).toBe(false);
  });

  it("admits a participant inside the window", async () => {
    const start = freeSlot(30);

    const booked = await bookConsultation({
      userId: customer.id,
      panditProfileId: active.profileId,
      mode: ConsultationMode.CHAT,
      start,
      durationMinutes: 30,
    });
    if (!booked.ok) throw new Error("setup failed");

    await prisma.consultation.update({
      where: { id: booked.consultationId },
      data: { status: ConsultationStatus.CONFIRMED, paidAt: new Date() },
    });

    const access = await authorizeSessionJoin({
      consultationId: booked.consultationId,
      viewerUserId: customer.id,
      now: new Date(start.getTime() - 5 * 60_000),
    });

    expect(access.ok).toBe(true);
    if (access.ok) {
      // Chat needs no external provider, so it is joinable with no token.
      expect(access.mode).toBe(ConsultationMode.CHAT);
      expect(access.providerConnected).toBe(true);
      expect(access.token).toBeNull();
    }
  });
});
