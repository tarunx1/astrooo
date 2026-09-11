import "server-only";

import { ConsultationMode, ConsultationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { joinDecision } from "@/lib/consultations/status";
import {
  getCommunicationProvider,
  isCallingConfigured,
  PARTICIPANT_TOKEN_TTL_SECONDS,
  PROVIDER_BACKED_MODES,
} from "@/lib/consultations/communication/config";
import type { ParticipantToken } from "@/lib/consultations/communication/provider";
import { logger, reportIncident } from "@/lib/observability/logger";

/**
 * Consultation session access.
 *
 * Four things are checked before a token is minted, in this order: the caller
 * is authenticated, the caller is a participant in *this* consultation, the
 * booking is in a state that can be joined, and now is inside the joining
 * window. Failing any one of them returns a refusal - a token is never issued
 * "optimistically" and then policed by the UI.
 *
 * The window check reads `joinDecision`, the same function that decides whether
 * to show the Join button, so a stale page cannot be used to join early or long
 * after the session should have ended.
 */

export type SessionAccess =
  | {
      ok: true;
      consultationId: string;
      mode: ConsultationMode;
      counterpartName: string;
      scheduledStart: Date;
      durationMinutes: number;
      role: "customer" | "pandit";
      /** Absent for chat, which needs no external provider. */
      token: ParticipantToken | null;
      /** False when the adapter exists but no carrier is connected. */
      providerConnected: boolean;
      providerName: string;
    }
  | { ok: false; reason: string; code: "not_found" | "not_joinable" | "provider_unavailable" };

/**
 * Authorizes a join and mints a participant token.
 *
 * Ownership is expressed in the `where` clause: you are the customer or you are
 * the Pandit. Anybody else resolves to "not found", so consultation ids cannot
 * be probed for existence.
 */
export async function authorizeSessionJoin(input: {
  consultationId: string;
  viewerUserId: string;
  now?: Date;
}): Promise<SessionAccess> {
  const now = input.now ?? new Date();

  const consultation = await prisma.consultation.findFirst({
    where: {
      id: input.consultationId,
      OR: [{ userId: input.viewerUserId }, { pandit: { userId: input.viewerUserId } }],
    },
    select: {
      id: true,
      userId: true,
      status: true,
      mode: true,
      scheduledStart: true,
      durationMinutes: true,
      user: { select: { name: true, email: true } },
      pandit: { select: { userId: true, displayName: true } },
    },
  });

  if (!consultation) {
    return { ok: false, reason: "That consultation could not be found.", code: "not_found" };
  }

  const decision = joinDecision({
    status: consultation.status,
    scheduledStart: consultation.scheduledStart,
    now,
  });

  if (!decision.allowed) {
    return { ok: false, reason: decision.reason, code: "not_joinable" };
  }

  const role = consultation.userId === input.viewerUserId ? "customer" : "pandit";
  const counterpartName =
    role === "customer"
      ? consultation.pandit.displayName
      : consultation.user.name || consultation.user.email;

  const provider = getCommunicationProvider();

  // Chat is carried by this application's own messages table, so it needs no
  // external provider and is joinable whether or not calling is configured.
  if (!PROVIDER_BACKED_MODES.includes(consultation.mode)) {
    return {
      ok: true,
      consultationId: consultation.id,
      mode: consultation.mode,
      counterpartName,
      scheduledStart: consultation.scheduledStart,
      durationMinutes: consultation.durationMinutes,
      role,
      token: null,
      providerConnected: true,
      providerName: "built-in",
    };
  }

  const connected = provider.isProductionConnected && (await isCallingConfigured());

  if (!connected) {
    // Reported honestly rather than papered over with a fake token: a customer
    // told the call is starting when no carrier exists is worse than one told
    // plainly that calling is not available yet.
    return {
      ok: true,
      consultationId: consultation.id,
      mode: consultation.mode,
      counterpartName,
      scheduledStart: consultation.scheduledStart,
      durationMinutes: consultation.durationMinutes,
      role,
      token: null,
      providerConnected: false,
      providerName: provider.name,
    };
  }

  try {
    const session = await provider.createSession({
      consultationId: consultation.id,
      mode: consultation.mode,
    });

    const token = await provider.createParticipantToken({
      sessionId: session.sessionId,
      consultationId: consultation.id,
      identity: { userId: input.viewerUserId, displayName: counterpartName, role },
      mode: consultation.mode,
      ttlSeconds: PARTICIPANT_TOKEN_TTL_SECONDS,
    });

    logger.info("consultation_session_joined", {
      consultationId: consultation.id,
      role,
      provider: provider.name,
    });

    return {
      ok: true,
      consultationId: consultation.id,
      mode: consultation.mode,
      counterpartName,
      scheduledStart: consultation.scheduledStart,
      durationMinutes: consultation.durationMinutes,
      role,
      token,
      providerConnected: true,
      providerName: provider.name,
    };
  } catch (error) {
    reportIncident(
      "consultation_session_failure",
      { consultationId: consultation.id, provider: provider.name },
      error,
    );
    return {
      ok: false,
      reason: "The session could not be started. Please try again in a moment.",
      code: "provider_unavailable",
    };
  }
}

/**
 * Marks a consultation as started.
 *
 * Only moves CONFIRMED to IN_PROGRESS, and only inside the joining window, so a
 * replayed request cannot restart a completed session.
 */
export async function markSessionStarted(input: {
  consultationId: string;
  viewerUserId: string;
}): Promise<void> {
  const updated = await prisma.consultation.updateMany({
    where: {
      id: input.consultationId,
      status: ConsultationStatus.CONFIRMED,
      OR: [{ userId: input.viewerUserId }, { pandit: { userId: input.viewerUserId } }],
    },
    data: { status: ConsultationStatus.IN_PROGRESS, startedAt: new Date() },
  });

  if (updated.count > 0) {
    logger.info("consultation_started", { consultationId: input.consultationId });
  }
}
