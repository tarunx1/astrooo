"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth/access";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import { sendChatMessage } from "@/lib/support/chat";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * Consultation chat Server Action.
 *
 * Shared by both sides of a conversation. Membership is checked inside
 * `sendChatMessage` against the consultation, so this action does not need to
 * know - and must not assume - which side is sending.
 */
export async function sendChatMessageAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const viewer = await getViewer();
  if (!viewer) {
    return { ok: false, error: "Sign in first.", fieldErrors: {} };
  }

  const decision = await checkRateLimit({ namespace: "chat:send", identifier: `user:${viewer.id}` });
  if (!decision.allowed) {
    return { ok: false, error: rateLimitMessage(decision.retryAfterSeconds), fieldErrors: {} };
  }

  const parsed = z
    .object({ consultationId: z.string().trim().min(1).max(64), body: z.string().trim().min(1).max(4_000) })
    .safeParse({ consultationId: formData.get("consultationId"), body: formData.get("body") });

  if (!parsed.success) return { ok: false, error: "Write a message first.", fieldErrors: {} };

  const result = await sendChatMessage({
    consultationId: parsed.data.consultationId,
    senderUserId: viewer.id,
    body: parsed.data.body,
  });

  if (!result.ok) return { ok: false, error: result.message, fieldErrors: {} };

  revalidatePath(`/pandit/chats/${parsed.data.consultationId}`);
  revalidatePath("/pandit/chats");
  revalidatePath(`/account/consultations/${parsed.data.consultationId}`);
  return { ok: true, error: null, message: "Sent.", fieldErrors: {} };
}
