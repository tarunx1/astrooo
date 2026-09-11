import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PanditOnboardingStatus, PujaBookingStatus, PujaMode, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getBookablePuja, getPuja, listPujas, parseSamagri, parseVidhi } from "@/lib/puja/catalog";
import {
  applyVerifiedPujaPayment,
  assignPujaPandit,
  getPujaBookingWithSankalp,
  listCustomerPujaBookings,
  listPujaBookingsForOperators,
  parseSankalp,
  transitionPujaBooking,
} from "@/lib/puja/bookings";
import { canTransitionPuja, isPujaOpen, PUJA_STATUS_LABEL, PUJA_TRANSITIONS } from "@/lib/puja/status";
import type { ProviderPayment } from "@/lib/payments/provider";

/**
 * The Puja marketplace.
 *
 * The properties worth protecting: an unpublished ritual is invisible, the
 * Sankalp reaches only the customer and the practitioner assigned to perform
 * it, and a booking cannot be scheduled onto nobody or walked backwards out of
 * a closed state.
 */
const RUN = `puja${Date.now().toString(36)}`;

type Actor = { id: string; email: string };

async function createUser(label: string, role: UserRole = UserRole.CUSTOMER): Promise<Actor> {
  return prisma.user.create({
    data: { name: `Puja ${label}`, email: `${RUN}.${label}@example.test`, emailVerified: true, role },
    select: { id: true, email: true },
  });
}

let customer: Actor;
let otherCustomer: Actor;
let operator: Actor;
let panditUser: Actor;
let panditProfileId: string;
let otherPanditProfileId: string;
let activePujaId: string;
let activeSlug: string;
let draftSlug: string;

const sankalp = {
  fullName: "Test Customer",
  gotra: "Kashyap",
  familyMembers: ["Spouse Name"],
  dateOfBirth: "1990-01-01",
  birthPlace: "Amritsar",
  intention: "Peace at home",
};

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set for puja tests.");

  customer = await createUser("customer");
  otherCustomer = await createUser("other");
  operator = await createUser("operator", UserRole.SUPER_ADMIN);
  panditUser = await createUser("pandit", UserRole.PANDIT);

  const profile = await prisma.panditProfile.create({
    data: {
      userId: panditUser.id,
      status: PanditOnboardingStatus.ACTIVE,
      displayName: `Pandit ${RUN}`,
      slug: `pandit-${RUN}`,
      languages: [],
      expertise: [],
      certifications: [],
    },
    select: { id: true },
  });
  panditProfileId = profile.id;

  const otherPanditUser = await createUser("pandit2", UserRole.PANDIT);
  const otherProfile = await prisma.panditProfile.create({
    data: {
      userId: otherPanditUser.id,
      // Deliberately not ACTIVE: used to prove an unavailable practitioner
      // cannot be assigned.
      status: PanditOnboardingStatus.SUSPENDED,
      displayName: `Suspended ${RUN}`,
      languages: [],
      expertise: [],
      certifications: [],
    },
    select: { id: true },
  });
  otherPanditProfileId = otherProfile.id;

  activeSlug = `${RUN}-navgrah`;
  draftSlug = `${RUN}-draft`;

  const active = await prisma.puja.create({
    data: {
      title: "Navgrah Shanti",
      slug: activeSlug,
      description: "A ritual described for testing.",
      shortDescription: "Testing ritual",
      purpose: "Peace",
      benefits: ["Traditionally performed for harmony"],
      requirements: ["A quiet space"],
      samagri: [{ name: "Ghee", quantity: "250g", providedByCustomer: false }],
      vidhi: [{ title: "Sankalp", description: "The intention is stated." }],
      durationMinutes: 90,
      pricePaise: 250_000,
      imageUrls: [],
      modes: [PujaMode.ONLINE, PujaMode.TEMPLE],
      active: true,
    },
    select: { id: true },
  });
  activePujaId = active.id;

  await prisma.puja.create({
    data: {
      title: "Unpublished ritual",
      slug: draftSlug,
      description: "Should never be visible.",
      benefits: [],
      requirements: [],
      pricePaise: 100_000,
      imageUrls: [],
      modes: [PujaMode.ONLINE],
      active: false,
    },
  });
}, 60_000);

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${RUN}.` } },
    select: { id: true, panditProfile: { select: { id: true } } },
  });

  const ids = users.map((user) => user.id);
  const panditIds = users.flatMap((user) => (user.panditProfile ? [user.panditProfile.id] : []));

  await prisma.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
  await prisma.payment.deleteMany({ where: { userId: { in: ids } } });
  await prisma.pujaBooking.deleteMany({ where: { userId: { in: ids } } });
  await prisma.puja.deleteMany({ where: { slug: { startsWith: RUN } } });
  await prisma.panditProfile.deleteMany({ where: { id: { in: panditIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

async function createPaidBooking(userId: string, mode: PujaMode = PujaMode.ONLINE) {
  const booking = await prisma.pujaBooking.create({
    data: {
      bookingNumber: `PJ-${RUN}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      userId,
      pujaId: activePujaId,
      status: PujaBookingStatus.PANDIT_PENDING,
      mode,
      titleSnapshot: "Navgrah Shanti",
      pricePaise: 250_000,
      paidAt: new Date(),
      sankalpJson: sankalp,
    },
    select: { id: true },
  });

  return booking.id;
}

describe("catalogue visibility", () => {
  it("lists a published ritual", async () => {
    const rows = await listPujas();
    expect(rows.some((row) => row.slug === activeSlug)).toBe(true);
  });

  it("never lists an unpublished ritual", async () => {
    const rows = await listPujas();
    expect(rows.some((row) => row.slug === draftSlug)).toBe(false);
  });

  it("does not resolve an unpublished ritual by slug", async () => {
    expect(await getPuja(draftSlug)).toBeNull();
    expect(await getBookablePuja(draftSlug)).toBeNull();
  });

  it("returns structured samagri and vidhi", async () => {
    const puja = await getPuja(activeSlug);
    expect(puja?.samagri).toHaveLength(1);
    expect(puja?.samagri[0].name).toBe("Ghee");
    expect(puja?.vidhi[0].title).toBe("Sankalp");
  });

  it("tolerates malformed stored content rather than throwing", async () => {
    // A row written by an older shape must render as a gap, not crash the page.
    expect(parseSamagri({ nonsense: true } as never)).toEqual([]);
    expect(parseVidhi("not an array" as never)).toEqual([]);
    expect(parseSankalp(null)).toBeNull();
  });
});

describe("booking payment", () => {
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

  it("confirms into the assignment queue and is idempotent", async () => {
    const booking = await prisma.pujaBooking.create({
      data: {
        bookingNumber: `PJ-${RUN}-PAY1`,
        userId: customer.id,
        pujaId: activePujaId,
        status: PujaBookingStatus.PENDING_PAYMENT,
        mode: PujaMode.ONLINE,
        titleSnapshot: "Navgrah Shanti",
        pricePaise: 250_000,
        providerOrderId: `order_${RUN}_pay1`,
        sankalpJson: sankalp,
      },
      select: { id: true },
    });

    const payment = providerPayment(`order_${RUN}_pay1`, 250_000, `pay_${RUN}_1`);

    const first = await applyVerifiedPujaPayment(booking.id, payment);
    expect(first.ok && first.alreadyPaid).toBe(false);

    const second = await applyVerifiedPujaPayment(booking.id, payment);
    expect(second.ok && second.alreadyPaid).toBe(true);

    const after = await prisma.pujaBooking.findUniqueOrThrow({
      where: { id: booking.id },
      select: { status: true },
    });
    // A paid booking waits for assignment; it is not "done".
    expect(after.status).toBe(PujaBookingStatus.PANDIT_PENDING);

    const payments = await prisma.payment.count({ where: { pujaBookingId: booking.id } });
    expect(payments).toBe(1);
  });

  it("refuses a payment for a different order", async () => {
    const booking = await prisma.pujaBooking.create({
      data: {
        bookingNumber: `PJ-${RUN}-PAY2`,
        userId: customer.id,
        pujaId: activePujaId,
        status: PujaBookingStatus.PENDING_PAYMENT,
        mode: PujaMode.ONLINE,
        titleSnapshot: "Navgrah Shanti",
        pricePaise: 250_000,
        providerOrderId: `order_${RUN}_mine`,
      },
      select: { id: true },
    });

    const result = await applyVerifiedPujaPayment(
      booking.id,
      providerPayment(`order_${RUN}_theirs`, 250_000, `pay_${RUN}_2`),
    );

    expect(result.ok).toBe(false);
  });

  it("refuses a payment whose amount does not match", async () => {
    const booking = await prisma.pujaBooking.create({
      data: {
        bookingNumber: `PJ-${RUN}-PAY3`,
        userId: customer.id,
        pujaId: activePujaId,
        status: PujaBookingStatus.PENDING_PAYMENT,
        mode: PujaMode.ONLINE,
        titleSnapshot: "Navgrah Shanti",
        pricePaise: 250_000,
        providerOrderId: `order_${RUN}_amount`,
      },
      select: { id: true },
    });

    const result = await applyVerifiedPujaPayment(
      booking.id,
      providerPayment(`order_${RUN}_amount`, 1, `pay_${RUN}_3`),
    );

    expect(result.ok).toBe(false);
  });
});

describe("sankalp privacy", () => {
  it("shows the sankalp to the customer who gave it", async () => {
    const bookingId = await createPaidBooking(customer.id);

    const view = await getPujaBookingWithSankalp({ bookingId, viewerUserId: customer.id });
    expect(view?.sankalp?.gotra).toBe("Kashyap");
  });

  it("hides it from another customer", async () => {
    const bookingId = await createPaidBooking(customer.id);

    const view = await getPujaBookingWithSankalp({ bookingId, viewerUserId: otherCustomer.id });
    expect(view).toBeNull();
  });

  it("hides it from a practitioner who is not assigned", async () => {
    const bookingId = await createPaidBooking(customer.id);

    const before = await getPujaBookingWithSankalp({ bookingId, viewerUserId: panditUser.id });
    expect(before).toBeNull();
  });

  it("shows it to the practitioner once they are assigned", async () => {
    const bookingId = await createPaidBooking(customer.id);

    const assigned = await assignPujaPandit({
      bookingId,
      panditProfileId,
      actorUserId: operator.id,
    });
    expect(assigned.ok).toBe(true);

    const after = await getPujaBookingWithSankalp({ bookingId, viewerUserId: panditUser.id });
    expect(after?.sankalp?.fullName).toBe("Test Customer");
  });

  it("never puts the sankalp in the operator queue", async () => {
    await createPaidBooking(customer.id);

    const { rows } = await listPujaBookingsForOperators({ page: 1, pageSize: 25 });
    const serialised = JSON.stringify(rows);

    expect(serialised).not.toContain("Kashyap");
    expect(serialised).not.toContain("Peace at home");
  });

  it("never puts the sankalp in the audit log", async () => {
    const bookingId = await createPaidBooking(customer.id);

    await assignPujaPandit({ bookingId, panditProfileId, actorUserId: operator.id });

    const entries = await prisma.auditLog.findMany({
      where: { entityType: "PujaBooking", entityId: bookingId },
      select: { metadata: true },
    });

    const serialised = JSON.stringify(entries);
    expect(serialised).not.toContain("Kashyap");
    expect(serialised).not.toContain("Test Customer");
  });

  it("never returns another customer's booking in a list", async () => {
    const bookingId = await createPaidBooking(customer.id);

    const theirs = await listCustomerPujaBookings(otherCustomer.id);
    expect(theirs.every((booking) => booking.id !== bookingId)).toBe(true);
  });
});

describe("pandit assignment", () => {
  it("refuses assigning a practitioner who is not active", async () => {
    const bookingId = await createPaidBooking(customer.id);

    const result = await assignPujaPandit({
      bookingId,
      panditProfileId: otherPanditProfileId,
      actorUserId: operator.id,
    });

    expect(result.ok).toBe(false);
  });

  it("moves the booking to ASSIGNED and back on clearing", async () => {
    const bookingId = await createPaidBooking(customer.id);

    await assignPujaPandit({ bookingId, panditProfileId, actorUserId: operator.id });

    const assigned = await prisma.pujaBooking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { status: true, panditProfileId: true, assignedAt: true },
    });
    expect(assigned.status).toBe(PujaBookingStatus.ASSIGNED);
    expect(assigned.panditProfileId).toBe(panditProfileId);
    expect(assigned.assignedAt).not.toBeNull();

    await assignPujaPandit({ bookingId, panditProfileId: null, actorUserId: operator.id });

    const cleared = await prisma.pujaBooking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { status: true, panditProfileId: true },
    });
    expect(cleared.status).toBe(PujaBookingStatus.PANDIT_PENDING);
    expect(cleared.panditProfileId).toBeNull();
  });
});

describe("booking lifecycle", () => {
  it("refuses scheduling without an assigned practitioner", async () => {
    const bookingId = await createPaidBooking(customer.id);

    // PANDIT_PENDING cannot reach SCHEDULED at all.
    const result = await transitionPujaBooking({
      bookingId,
      to: PujaBookingStatus.SCHEDULED,
      actorUserId: operator.id,
      scheduledAt: new Date(Date.now() + 86_400_000),
    });

    expect(result.ok).toBe(false);
  });

  it("refuses scheduling without a date", async () => {
    const bookingId = await createPaidBooking(customer.id);
    await assignPujaPandit({ bookingId, panditProfileId, actorUserId: operator.id });

    const result = await transitionPujaBooking({
      bookingId,
      to: PujaBookingStatus.SCHEDULED,
      actorUserId: operator.id,
      scheduledAt: null,
    });

    expect(result.ok).toBe(false);
  });

  it("schedules and completes", async () => {
    const bookingId = await createPaidBooking(customer.id);
    await assignPujaPandit({ bookingId, panditProfileId, actorUserId: operator.id });

    const when = new Date(Date.now() + 86_400_000);

    const scheduled = await transitionPujaBooking({
      bookingId,
      to: PujaBookingStatus.SCHEDULED,
      actorUserId: operator.id,
      scheduledAt: when,
    });
    expect(scheduled.ok).toBe(true);

    const completed = await transitionPujaBooking({
      bookingId,
      to: PujaBookingStatus.COMPLETED,
      actorUserId: operator.id,
    });
    expect(completed.ok).toBe(true);

    const row = await prisma.pujaBooking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { status: true, completedAt: true, scheduledAt: true },
    });
    expect(row.status).toBe(PujaBookingStatus.COMPLETED);
    expect(row.completedAt).not.toBeNull();
    expect(row.scheduledAt?.getTime()).toBe(when.getTime());
  });

  it("refuses walking a completed booking backwards", async () => {
    const bookingId = await createPaidBooking(customer.id);
    await assignPujaPandit({ bookingId, panditProfileId, actorUserId: operator.id });
    await transitionPujaBooking({
      bookingId,
      to: PujaBookingStatus.SCHEDULED,
      actorUserId: operator.id,
      scheduledAt: new Date(Date.now() + 86_400_000),
    });
    await transitionPujaBooking({
      bookingId,
      to: PujaBookingStatus.COMPLETED,
      actorUserId: operator.id,
    });

    const back = await transitionPujaBooking({
      bookingId,
      to: PujaBookingStatus.SCHEDULED,
      actorUserId: operator.id,
      scheduledAt: new Date(Date.now() + 86_400_000),
    });

    expect(back.ok).toBe(false);
  });
});

describe("status rules", () => {
  it("declares a label for every status", () => {
    for (const status of Object.values(PujaBookingStatus)) {
      expect(PUJA_STATUS_LABEL[status]).toBeTruthy();
    }
  });

  it("makes REFUNDED terminal", () => {
    expect(PUJA_TRANSITIONS.REFUNDED).toEqual([]);
  });

  it("treats closed statuses as closed", () => {
    expect(isPujaOpen(PujaBookingStatus.SCHEDULED)).toBe(true);
    expect(isPujaOpen(PujaBookingStatus.COMPLETED)).toBe(false);
    expect(isPujaOpen(PujaBookingStatus.CANCELLED)).toBe(false);
    expect(isPujaOpen(PujaBookingStatus.REFUNDED)).toBe(false);
  });

  it("refuses a move the table does not contain", () => {
    expect(canTransitionPuja(PujaBookingStatus.PENDING_PAYMENT, PujaBookingStatus.COMPLETED)).toBe(false);
    expect(canTransitionPuja(PujaBookingStatus.PANDIT_PENDING, PujaBookingStatus.SCHEDULED)).toBe(false);
    expect(canTransitionPuja(PujaBookingStatus.ASSIGNED, PujaBookingStatus.SCHEDULED)).toBe(true);
  });
});
