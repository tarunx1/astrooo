import "server-only";

import { ConsultationMode, ConsultationStatus, Prisma, RateType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSettings } from "@/lib/settings/service";
import { isBookable } from "@/lib/pandit/onboarding";
import { BOOKABLE_DURATIONS_MINUTES, SLOT_GRANULARITY_MINUTES } from "@/lib/pandit/catalog";

/**
 * Availability and booking.
 *
 * Availability is computed, never stored as a list of free slots: a stored list
 * has to be regenerated whenever a rule, an exception or a booking changes, and
 * every one of those regenerations is a chance for the calendar the customer
 * sees to disagree with the calendar the booker enforces. Here there is one
 * derivation, used by both.
 *
 * Times are held as minutes from local midnight in the Pandit's own timezone,
 * so "Monday 09:00-12:00" means the same thing in March and in November without
 * anybody storing an offset that goes stale.
 */

export class ScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleError";
  }
}

/* ------------------------------------------------------------------ */
/* Timezone arithmetic                                                 */
/* ------------------------------------------------------------------ */

/**
 * The wall-clock parts of an instant, in a named zone.
 *
 * Built from Intl rather than a date library because the zone database is
 * already in the runtime, and because the rules that matter here - which side
 * of a DST change a slot falls on - are exactly the rules Intl is maintained to
 * get right.
 */
function zonedParts(instant: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  );

  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday ?? "Sun");

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Intl renders midnight as "24" in some locales' hour12:false output.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: weekdayIndex < 0 ? 0 : weekdayIndex,
  };
}

/** The UTC offset, in minutes, that `timeZone` is at during `instant`. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  // Seconds and milliseconds are dropped by the formatter, so compare at
  // minute resolution on both sides.
  const truncated = Math.floor(instant.getTime() / 60_000) * 60_000;
  return (asUtc - truncated) / 60_000;
}

/**
 * The instant at which a local wall-clock time occurs in a zone.
 *
 * Two passes: guess with the offset at the naive instant, then re-resolve with
 * the offset actually in force at the guess. That is what makes a slot an hour
 * either side of a DST change land on the time the Pandit meant rather than an
 * hour away from it.
 */
export function zonedTimeToInstant(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  minutesFromMidnight: number,
): Date {
  const hour = Math.floor(minutesFromMidnight / 60);
  const minute = minutesFromMidnight % 60;
  const naive = Date.UTC(year, month - 1, day, hour, minute);

  const firstGuess = new Date(naive - offsetMinutes(new Date(naive), timeZone) * 60_000);
  const corrected = new Date(naive - offsetMinutes(firstGuess, timeZone) * 60_000);

  return corrected;
}

/** Local calendar date, as {year, month, day}, for an instant in a zone. */
export function localDateOf(instant: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = zonedParts(instant, timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

/* ------------------------------------------------------------------ */
/* Schedule editing                                                    */
/* ------------------------------------------------------------------ */

export const scheduleRuleSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(24 * 60 - 1),
    endMinute: z.number().int().min(1).max(24 * 60),
  })
  .refine((rule) => rule.endMinute > rule.startMinute, {
    message: "The window must end after it starts.",
    path: ["endMinute"],
  })
  .refine((rule) => rule.startMinute % SLOT_GRANULARITY_MINUTES === 0 && rule.endMinute % SLOT_GRANULARITY_MINUTES === 0, {
    message: `Times must fall on ${SLOT_GRANULARITY_MINUTES}-minute boundaries.`,
    path: ["startMinute"],
  });

export type ScheduleRuleInput = z.infer<typeof scheduleRuleSchema>;

/**
 * Adds one weekly window.
 *
 * Overlapping windows on the same day are merged rather than refused: a Pandit
 * adding 09:00-12:00 when 10:00-11:00 already exists meant to be available from
 * nine to twelve, and storing both would make availability depend on which row
 * a later query happened to read first.
 */
export async function addScheduleRule(userId: string, input: ScheduleRuleInput): Promise<void> {
  const profile = await prisma.panditProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new ScheduleError("No Pandit profile for this account.");

  await prisma.$transaction(async (tx) => {
    const existing = await tx.panditScheduleRule.findMany({
      where: { panditProfileId: profile.id, weekday: input.weekday },
      select: { id: true, startMinute: true, endMinute: true },
    });

    let start = input.startMinute;
    let end = input.endMinute;
    const absorbed: string[] = [];

    for (const rule of existing) {
      // Touching counts as overlapping: 09:00-12:00 and 12:00-14:00 is one
      // window from nine to two, not two adjacent ones.
      if (rule.startMinute <= end && rule.endMinute >= start) {
        start = Math.min(start, rule.startMinute);
        end = Math.max(end, rule.endMinute);
        absorbed.push(rule.id);
      }
    }

    if (absorbed.length > 0) {
      await tx.panditScheduleRule.deleteMany({ where: { id: { in: absorbed } } });
    }

    await tx.panditScheduleRule.create({
      data: { panditProfileId: profile.id, weekday: input.weekday, startMinute: start, endMinute: end },
    });
  });
}

export async function removeScheduleRule(userId: string, ruleId: string): Promise<void> {
  const deleted = await prisma.panditScheduleRule.deleteMany({
    where: { id: ruleId, pandit: { userId } },
  });
  if (deleted.count === 0) throw new ScheduleError("That availability window could not be found.");
}

export const scheduleExceptionSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date."),
    available: z.boolean(),
    startMinute: z.number().int().min(0).max(24 * 60 - 1).nullable(),
    endMinute: z.number().int().min(1).max(24 * 60).nullable(),
    note: z.string().trim().max(200).nullable(),
  })
  .refine((value) => !value.available || (value.startMinute !== null && value.endMinute !== null), {
    message: "An extra-availability date needs a window.",
    path: ["startMinute"],
  })
  .refine(
    (value) => value.startMinute === null || value.endMinute === null || value.endMinute > value.startMinute,
    { message: "The window must end after it starts.", path: ["endMinute"] },
  );

export async function saveScheduleException(
  userId: string,
  input: z.infer<typeof scheduleExceptionSchema>,
): Promise<void> {
  const profile = await prisma.panditProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new ScheduleError("No Pandit profile for this account.");

  await prisma.panditScheduleException.create({
    data: {
      panditProfileId: profile.id,
      date: new Date(`${input.date}T00:00:00.000Z`),
      available: input.available,
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      note: input.note,
    },
  });
}

export async function removeScheduleException(userId: string, exceptionId: string): Promise<void> {
  const deleted = await prisma.panditScheduleException.deleteMany({
    where: { id: exceptionId, pandit: { userId } },
  });
  if (deleted.count === 0) throw new ScheduleError("That date could not be found.");
}

/* ------------------------------------------------------------------ */
/* Availability                                                        */
/* ------------------------------------------------------------------ */

export type AvailableSlot = { start: Date; end: Date };

/**
 * The bookable slots for one Pandit over a window.
 *
 * A slot is offered only when all of these hold: the Pandit is ACTIVE, the slot
 * sits inside a weekly rule or an extra-availability exception, it is not on a
 * blocked date, it does not overlap a slot already held, and it is far enough
 * ahead to satisfy the platform's minimum notice.
 *
 * Overlap is checked against `ConsultationSlot`, which holds a row only while a
 * slot is actually reserved - so a cancelled booking frees its time by deleting
 * one row rather than by any recomputation.
 */
export async function availableSlots(input: {
  panditProfileId: string;
  from: Date;
  to: Date;
  durationMinutes: number;
}): Promise<AvailableSlot[]> {
  if (!BOOKABLE_DURATIONS_MINUTES.includes(input.durationMinutes)) {
    throw new ScheduleError("That session length is not offered.");
  }

  const profile = await prisma.panditProfile.findUnique({
    where: { id: input.panditProfileId },
    select: {
      id: true,
      status: true,
      timezone: true,
      scheduleRules: { select: { weekday: true, startMinute: true, endMinute: true } },
      scheduleExceptions: {
        select: { date: true, available: true, startMinute: true, endMinute: true },
      },
    },
  });

  if (!profile || !isBookable(profile.status)) return [];

  const settings = await getSettings([
    "consultations.enabled",
    "consultations.minNoticeMinutes",
    "consultations.maxAdvanceDays",
  ]);

  if (!settings["consultations.enabled"]) return [];

  const now = Date.now();
  const earliest = now + settings["consultations.minNoticeMinutes"] * 60_000;
  const latest = now + settings["consultations.maxAdvanceDays"] * 24 * 60 * 60_000;

  const windowStart = new Date(Math.max(input.from.getTime(), earliest));
  const windowEnd = new Date(Math.min(input.to.getTime(), latest));
  if (windowEnd <= windowStart) return [];

  const held = await prisma.consultationSlot.findMany({
    where: {
      panditProfileId: profile.id,
      startsAt: { lt: windowEnd },
      endsAt: { gt: windowStart },
    },
    select: { startsAt: true, endsAt: true },
  });

  const timeZone = profile.timezone;

  // Exceptions are keyed by the calendar date they were saved against. They are
  // stored as a bare date at UTC midnight, so read the UTC parts back out
  // rather than re-interpreting them in the Pandit's zone.
  const blockedDates = new Set<string>();
  const extraWindows = new Map<string, Array<{ startMinute: number; endMinute: number }>>();

  for (const exception of profile.scheduleExceptions) {
    const key = exception.date.toISOString().slice(0, 10);
    if (!exception.available) {
      blockedDates.add(key);
      continue;
    }
    if (exception.startMinute === null || exception.endMinute === null) continue;
    const list = extraWindows.get(key) ?? [];
    list.push({ startMinute: exception.startMinute, endMinute: exception.endMinute });
    extraWindows.set(key, list);
  }

  const slots: AvailableSlot[] = [];

  // Walk local calendar days, starting one day early so a window that began
  // before `windowStart` still contributes its later slots.
  const firstDay = localDateOf(new Date(windowStart.getTime() - 24 * 60 * 60_000), timeZone);
  const cursor = new Date(Date.UTC(firstDay.year, firstDay.month - 1, firstDay.day));
  const lastDay = localDateOf(windowEnd, timeZone);
  const endCursor = new Date(Date.UTC(lastDay.year, lastDay.month - 1, lastDay.day));

  while (cursor <= endCursor) {
    const key = cursor.toISOString().slice(0, 10);
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const day = cursor.getUTCDate();
    const weekday = cursor.getUTCDay();

    if (!blockedDates.has(key)) {
      const windows = [
        ...profile.scheduleRules
          .filter((rule) => rule.weekday === weekday)
          .map((rule) => ({ startMinute: rule.startMinute, endMinute: rule.endMinute })),
        ...(extraWindows.get(key) ?? []),
      ];

      for (const window of windows) {
        for (
          let minute = window.startMinute;
          minute + input.durationMinutes <= window.endMinute;
          minute += SLOT_GRANULARITY_MINUTES
        ) {
          const start = zonedTimeToInstant(timeZone, year, month, day, minute);
          const end = new Date(start.getTime() + input.durationMinutes * 60_000);

          if (start < windowStart || end > windowEnd) continue;

          const clashes = held.some((slot) => slot.startsAt < end && slot.endsAt > start);
          if (clashes) continue;

          slots.push({ start, end });
        }
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // A slot can be produced twice when a weekly rule and an extra window cover
  // the same time. Dedupe and order so the caller gets a clean list.
  const seen = new Set<number>();
  return slots
    .filter((slot) => {
      const key = slot.start.getTime();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/* ------------------------------------------------------------------ */
/* Booking                                                             */
/* ------------------------------------------------------------------ */

export type BookingInput = {
  userId: string;
  panditProfileId: string;
  mode: ConsultationMode;
  start: Date;
  durationMinutes: number;
  birthProfileId?: string | null;
  notes?: string | null;
};

export type BookingResult =
  | { ok: true; consultationId: string }
  | { ok: false; message: string };

/**
 * Books one consultation.
 *
 * Double booking is prevented by the database, not by a check: the reservation
 * is a row in `ConsultationSlot` whose `(panditProfileId, startsAt)` is unique,
 * so two requests racing for the same start resolve to one winner however the
 * race arrived. The overlap scan inside the transaction covers the rest - a
 * 60-minute session starting at 09:00 and a 30-minute one starting at 09:30
 * have different starts but cannot both happen.
 *
 * Price is computed here from the Pandit's current rate and then snapshotted
 * onto the consultation. Nothing the browser sent about price is consulted.
 */
export async function bookConsultation(input: BookingInput): Promise<BookingResult> {
  if (!BOOKABLE_DURATIONS_MINUTES.includes(input.durationMinutes)) {
    return { ok: false, message: "That session length is not offered." };
  }

  const settings = await getSettings([
    "consultations.enabled",
    "consultations.minNoticeMinutes",
    "consultations.maxAdvanceDays",
  ]);

  if (!settings["consultations.enabled"]) {
    return { ok: false, message: "Consultations are not open for booking right now." };
  }

  const now = Date.now();
  if (input.start.getTime() < now + settings["consultations.minNoticeMinutes"] * 60_000) {
    return { ok: false, message: "That slot is too soon to book." };
  }
  if (input.start.getTime() > now + settings["consultations.maxAdvanceDays"] * 24 * 60 * 60_000) {
    return { ok: false, message: "That slot is further ahead than bookings are open." };
  }

  const end = new Date(input.start.getTime() + input.durationMinutes * 60_000);

  try {
    return await prisma.$transaction(async (tx) => {
      const profile = await tx.panditProfile.findUnique({
        where: { id: input.panditProfileId },
        select: {
          id: true,
          userId: true,
          status: true,
          timezone: true,
          services: { where: { mode: input.mode }, select: { enabled: true, rateType: true, ratePaise: true, sessionMinutes: true } },
        },
      });

      if (!profile) return { ok: false as const, message: "That Pandit could not be found." };

      // Re-checked inside the transaction: a Pandit suspended a moment ago must
      // not be bookable by a request that read their status a moment before.
      if (!isBookable(profile.status)) {
        return { ok: false as const, message: "This Pandit is not currently taking bookings." };
      }

      if (profile.userId === input.userId) {
        return { ok: false as const, message: "You cannot book a consultation with yourself." };
      }

      const service = profile.services[0];
      if (!service?.enabled) {
        return { ok: false as const, message: "This Pandit does not offer that consultation type." };
      }

      // A birth profile may be attached only when the booker owns it.
      if (input.birthProfileId) {
        const owned = await tx.birthProfile.findFirst({
          where: { id: input.birthProfileId, userId: input.userId },
          select: { id: true },
        });
        if (!owned) return { ok: false as const, message: "That birth profile could not be found." };
      }

      const overlapping = await tx.consultationSlot.findFirst({
        where: {
          panditProfileId: profile.id,
          startsAt: { lt: end },
          endsAt: { gt: input.start },
        },
        select: { id: true },
      });

      if (overlapping) {
        return { ok: false as const, message: "That slot has just been taken. Please pick another." };
      }

      const grossAmountPaise =
        service.rateType === RateType.PER_MINUTE
          ? service.ratePaise * input.durationMinutes
          : service.ratePaise;

      const slot = await tx.consultationSlot.create({
        data: { panditProfileId: profile.id, startsAt: input.start, endsAt: end },
        select: { id: true },
      });

      const consultation = await tx.consultation.create({
        data: {
          userId: input.userId,
          panditProfileId: profile.id,
          slotId: slot.id,
          birthProfileId: input.birthProfileId ?? null,
          status: ConsultationStatus.REQUESTED,
          mode: input.mode,
          timezone: profile.timezone,
          scheduledStart: input.start,
          scheduledEnd: end,
          durationMinutes: input.durationMinutes,
          rateType: service.rateType,
          ratePaise: service.ratePaise,
          grossAmountPaise,
          notes: input.notes?.trim().slice(0, 1_000) || null,
        },
        select: { id: true },
      });

      return { ok: true as const, consultationId: consultation.id };
    });
  } catch (error) {
    // The unique constraint firing means someone else won the race between our
    // overlap scan and our insert. That is the constraint doing its job, and it
    // is a normal outcome, not a fault.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, message: "That slot has just been taken. Please pick another." };
    }
    throw error;
  }
}

/**
 * Cancels a consultation and frees its slot.
 *
 * Either party may cancel. The slot row is deleted so the time becomes bookable
 * again, while the consultation keeps its own scheduled times - the record of
 * what was booked survives the cancellation.
 */
export async function cancelConsultation(input: {
  consultationId: string;
  actorUserId: string;
  reason?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return prisma.$transaction(async (tx) => {
    const consultation = await tx.consultation.findFirst({
      where: {
        id: input.consultationId,
        OR: [{ userId: input.actorUserId }, { pandit: { userId: input.actorUserId } }],
      },
      select: { id: true, status: true, slotId: true },
    });

    if (!consultation) return { ok: false as const, message: "That consultation could not be found." };

    if (
      consultation.status === ConsultationStatus.COMPLETED ||
      consultation.status === ConsultationStatus.CANCELLED
    ) {
      return { ok: false as const, message: "That consultation can no longer be cancelled." };
    }

    await tx.consultation.update({
      where: { id: consultation.id },
      data: {
        status: ConsultationStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: input.actorUserId,
        cancellationReason: input.reason?.trim().slice(0, 500) || null,
        slotId: null,
      },
    });

    if (consultation.slotId) {
      await tx.consultationSlot.delete({ where: { id: consultation.slotId } });
    }

    return { ok: true as const };
  });
}
