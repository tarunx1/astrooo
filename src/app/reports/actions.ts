"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createReportOrderForUser } from "@/lib/reports/orders";
import { getCurrentUser } from "@/lib/auth/session";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";

export type ReportCheckoutState = {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
};

const checkoutSchema = z.object({
  reportDefinitionId: z.string().min(1).max(128),
  birthProfileId: z.string().min(1).max(128),
});

export async function createReportCheckoutAction(
  _state: ReportCheckoutState,
  formData: FormData,
): Promise<ReportCheckoutState> {
  const user = await getCurrentUser();
  if (!user) {
    return { formErrors: ["Your session has expired. Please sign in again."], fieldErrors: {} };
  }

  // Creating a report order calls the payment provider, so it is limited first.
  const limit = await checkRateLimit({ namespace: "payment:order-create", identifier: `user:${user.id}` });
  if (!limit.allowed) {
    return { formErrors: [rateLimitMessage(limit.retryAfterSeconds)], fieldErrors: {} };
  }

  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return { formErrors: flattened.formErrors, fieldErrors: flattened.fieldErrors };
  }

  const outcome = await createReportOrderForUser(user.id, parsed.data);
  if (!outcome.ok) {
    return { formErrors: [outcome.message], fieldErrors: {} };
  }

  redirect(`/checkout/report/${outcome.orderId}`);
}
