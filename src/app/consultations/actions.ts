"use server";

import { revalidatePath } from "next/cache";
import { ConsultationMode } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import { availableSlots } from "@/lib/pandit/schedule";
import { getBookablePandit } from "@/lib/consultations/directory";
import { startConsultationCheckout, type CheckoutSummary } from "@/lib/consultations/checkout";
import { cancelConsultationForUser, verifyConsultationPayment } from "@/lib/consultations/bookings";
import { BOOKABLE_DURATIONS_MINUTES } from "@/lib/pandit/catalog";

/**
 * Customer booking actions.
 *
 * Availability is read through `availableSlots` - the same function the Pandit
 * dashboard uses - so what a customer is offered and what the booker will
 * accept are derived from one place. A second availability calculation for the
 * customer side is exactly how a calendar starts disagreeing with itself.
 */
const slugSchema = z.string().trim().min(1).max(80);

export type SlotOption = { startISO: string; endISO: string };

export type SlotsResult =
  | { ok: true; slots: SlotOption[]; timezone: string }
  | { ok: false; message: string };

/**
 * Lists bookable slots for one practitioner on one local date.
 *
 * Public: a visitor deciding whether to sign up should be able to see whether
 * there is a time that suits them. It exposes only start and end instants for a
 * Pandit who is already publicly listed.
 */
export async function listSlotsAction(input: {
  slug: string;
  date: string;
  mode: string;
  durationMinutes: number;
}): Promise<SlotsResult> {
  const parsed = z
    .object({
      slug: slugSchema,
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date."),
      mode: z.nativeEnum(ConsultationMode),
      durationMinutes: z.number().int().refine((value) => BOOKABLE_DURATIONS_MINUTES.includes(value)),
    })
    .safeParse(input);

  if (!parsed.success) return { ok: false, message: "That request is not recognised." };

  const pandit = await getBookablePandit(parsed.data.slug);
  if (!pandit) return { ok: false, message: "This practitioner is not currently taking bookings." };

  const offersMode = pandit.services.some((service) => service.mode === parsed.data.mode);
  if (!offersMode) return { ok: false, message: "That consultation type is not offered." };

  // The requested local day, expanded to a full day in the Pandit's zone with a
  // margin either side so a window that starts late in the previous local day
  // still contributes.
  const from = new Date(`${parsed.data.date}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(`${parsed.data.date}T00:00:00.000Z`);
  to.setUTCDate(to.getUTCDate() + 2);

  const slots = await availableSlots({
    panditProfileId: pandit.id,
    from,
    to,
    durationMinutes: parsed.data.durationMinutes,
  });

  // Narrow to the requested local date, now that the generator has done the
  // timezone work.
  const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: pandit.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const onRequestedDay = slots.filter(
    (slot) => dayFormatter.format(slot.start) === parsed.data.date,
  );

  return {
    ok: true,
    timezone: pandit.timezone,
    slots: onRequestedDay.map((slot) => ({
      startISO: slot.start.toISOString(),
      endISO: slot.end.toISOString(),
    })),
  };
}

export type StartCheckoutResult =
  | { ok: true; summary: CheckoutSummary }
  | { ok: false; message: string; needsAuth?: boolean };

/**
 * Holds a slot and opens payment for it.
 *
 * Requires an account, because a consultation is a relationship between two
 * identified people and the customer needs somewhere to see it afterwards.
 */
export async function startBookingAction(input: {
  slug: string;
  mode: string;
  startISO: string;
  durationMinutes: number;
  notes?: string;
  birthProfileId?: string;
}): Promise<StartCheckoutResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, needsAuth: true, message: "Sign in to complete your booking." };
  }

  const decision = await checkRateLimit({ namespace: "booking:create", identifier: `user:${user.id}` });
  if (!decision.allowed) return { ok: false, message: rateLimitMessage(decision.retryAfterSeconds) };

  const parsed = z
    .object({
      slug: slugSchema,
      mode: z.nativeEnum(ConsultationMode),
      startISO: z.string().datetime(),
      durationMinutes: z.number().int().refine((value) => BOOKABLE_DURATIONS_MINUTES.includes(value)),
      notes: z.string().trim().max(1_000).optional(),
      birthProfileId: z.string().trim().min(1).max(64).optional(),
    })
    .safeParse(input);

  if (!parsed.success) return { ok: false, message: "Check the booking details and try again." };

  const result = await startConsultationCheckout({
    userId: user.id,
    userName: user.name,
    slug: parsed.data.slug,
    mode: parsed.data.mode,
    start: new Date(parsed.data.startISO),
    durationMinutes: parsed.data.durationMinutes,
    notes: parsed.data.notes ?? null,
    birthProfileId: parsed.data.birthProfileId ?? null,
  });

  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath(`/consultations/${parsed.data.slug}`);
  return { ok: true, summary: result.summary };
}

/**
 * Confirms a booking from the browser callback.
 *
 * The signature is verified server-side and the payment re-fetched from the
 * provider; nothing about success is taken from the browser. The webhook is
 * still authoritative, and both paths are idempotent, so whichever arrives
 * first confirms the booking and the second is a no-op.
 */
export async function verifyBookingPaymentAction(
  consultationId: string,
  response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in to complete your booking." };

  const decision = await checkRateLimit({ namespace: "payment:verify", identifier: `user:${user.id}` });
  if (!decision.allowed) return { ok: false, message: rateLimitMessage(decision.retryAfterSeconds) };

  const result = await verifyConsultationPayment({
    consultationId,
    userId: user.id,
    orderId: response.razorpay_order_id,
    paymentId: response.razorpay_payment_id,
    signature: response.razorpay_signature,
  });

  if (!result.ok) return result;

  revalidatePath("/account/consultations");
  revalidatePath("/pandit/consultations");
  return { ok: true };
}

/** Cancels the caller's own booking, subject to the cancellation policy. */
export async function cancelBookingAction(
  consultationId: string,
  reason?: string,
): Promise<{ ok: true; refundable: boolean } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const result = await cancelConsultationForUser({
    consultationId,
    userId: user.id,
    reason: reason ?? null,
  });

  if (!result.ok) return result;

  revalidatePath("/account/consultations");
  revalidatePath("/pandit/consultations");
  return { ok: true, refundable: result.refundable };
}
