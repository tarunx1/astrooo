"use server";

import { revalidatePath } from "next/cache";
import { PujaBookingStatus } from "@prisma/client";
import { z } from "zod";
import { authorizeAction } from "@/lib/auth/access";
import { assignPujaPandit, transitionPujaBooking } from "@/lib/puja/bookings";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * Puja operations.
 *
 * Assignment and status changes need `services.manage`, which is delegable -
 * running the puja queue is exactly the operational work an employee can be
 * given. Neither action can reach the customer's Sankalp.
 */
const idSchema = z.string().trim().min(1).max(64);

function denied(reason?: string): AdminActionState {
  return { ok: false, error: reason ?? "You are not authorised to perform this action.", fieldErrors: {} };
}

function failure(error: string): AdminActionState {
  return { ok: false, error, fieldErrors: {} };
}

function success(message: string): AdminActionState {
  return { ok: true, error: null, message, fieldErrors: {} };
}

function revalidate(bookingId: string): void {
  revalidatePath("/admin/puja/bookings");
  revalidatePath(`/admin/puja/bookings/${bookingId}`);
  revalidatePath("/account/puja");
  revalidatePath("/admin/audit");
}

export async function assignPujaPanditAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeAction("puja.manage");
  if (!auth.ok) return denied(auth.error);

  const raw = formData.get("panditProfileId");

  const parsed = z
    .object({ bookingId: idSchema, panditProfileId: idSchema.nullable() })
    .safeParse({
      bookingId: formData.get("bookingId"),
      panditProfileId: typeof raw === "string" && raw.trim() ? raw.trim() : null,
    });

  if (!parsed.success) return failure("That assignment is not recognised.");

  const result = await assignPujaPandit({
    bookingId: parsed.data.bookingId,
    panditProfileId: parsed.data.panditProfileId,
    actorUserId: auth.viewer.id,
  });

  if (!result.ok) return failure(result.message);

  revalidate(parsed.data.bookingId);
  return success(parsed.data.panditProfileId ? "Practitioner assigned." : "Assignment cleared.");
}

export async function transitionPujaBookingAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeAction("puja.manage");
  if (!auth.ok) return denied(auth.error);

  const scheduledRaw = formData.get("scheduledAt");

  const parsed = z
    .object({
      bookingId: idSchema,
      to: z.nativeEnum(PujaBookingStatus),
      scheduledAt: z.string().datetime().nullable(),
      note: z.string().trim().max(1_000).nullable(),
    })
    .safeParse({
      bookingId: formData.get("bookingId"),
      to: formData.get("to"),
      scheduledAt:
        typeof scheduledRaw === "string" && scheduledRaw.trim()
          ? new Date(scheduledRaw).toISOString()
          : null,
      note: (formData.get("note") as string)?.trim() || null,
    });

  if (!parsed.success) return failure("That status change is not recognised.");

  const result = await transitionPujaBooking({
    bookingId: parsed.data.bookingId,
    to: parsed.data.to,
    actorUserId: auth.viewer.id,
    scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
    note: parsed.data.note,
  });

  if (!result.ok) return failure(result.message);

  revalidate(parsed.data.bookingId);
  return success("Booking updated.");
}
