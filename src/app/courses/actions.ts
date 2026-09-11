"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import { enrolInFreeCourse } from "@/lib/content/courses";

/**
 * Course enrolment.
 *
 * Only free enrolment is exposed. A paid course is refused here rather than
 * quietly enrolled, and the service refuses it independently - so the gate does
 * not depend on this action remembering to check.
 */
export type EnrolActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; needsAuth?: boolean };

export async function enrolAction(courseId: string): Promise<EnrolActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, needsAuth: true, message: "Sign in to enrol." };

  const decision = await checkRateLimit({ namespace: "cart:mutation", identifier: `user:${user.id}` });
  if (!decision.allowed) return { ok: false, message: rateLimitMessage(decision.retryAfterSeconds) };

  const parsed = z.string().trim().min(1).max(64).safeParse(courseId);
  if (!parsed.success) return { ok: false, message: "That course is not recognised." };

  const result = await enrolInFreeCourse({ userId: user.id, courseId: parsed.data });

  if (!result.ok) {
    return {
      ok: false,
      message: result.requiresPayment
        ? "This course is paid. Paid enrolment is not open yet."
        : result.message,
    };
  }

  revalidatePath("/account/courses");
  return {
    ok: true,
    message: result.alreadyEnrolled ? "You are already enrolled." : "You are enrolled.",
  };
}
