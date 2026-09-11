import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { ConsultationMode } from "@prisma/client";
import { getSecret } from "@/lib/settings/service";
import {
  PARTICIPANT_TOKEN_TTL_SECONDS,
  ProviderNotConfiguredError,
  type CommunicationSession,
  type ConsultationCommunicationProvider,
  type ParticipantToken,
  type SessionStatus,
} from "@/lib/consultations/communication/provider";

/**
 * Provider selection.
 *
 * There is exactly one implementation today - a development adapter - and it
 * says so. `isProductionConnected` is false for it, and every caller surfaces
 * that rather than letting a customer walk into a call that cannot connect.
 *
 * Adding a real provider is implementing the interface and registering it here;
 * nothing else in the application changes.
 */

/**
 * Chat needs no external provider.
 *
 * Messages are rows in this database, scoped to a consultation, which is both
 * simpler and more private than renting a chat service. Only voice and video
 * need a third party, which is why the adapter below declares support for
 * exactly those two.
 */
export const PROVIDER_BACKED_MODES: readonly ConsultationMode[] = [
  ConsultationMode.VOICE_CALL,
  ConsultationMode.VIDEO_CALL,
];

/**
 * The development adapter.
 *
 * It mints a signed, short-lived token with the same shape and the same
 * lifetime a real provider's token would have, so the whole flow - authorize,
 * mint, join, expire - is exercised end to end. What it cannot do is carry
 * audio or video, and it does not claim to: `isProductionConnected` is false,
 * and the session page renders a clearly-labelled unavailable state instead of
 * a dead call window.
 *
 * This is deliberately not a mock that pretends to succeed. It is the real
 * lifecycle with an honest gap where the carrier goes.
 */
class DevelopmentCommunicationProvider implements ConsultationCommunicationProvider {
  readonly name = "development";
  readonly isProductionConnected = false;

  supports(mode: ConsultationMode): boolean {
    return PROVIDER_BACKED_MODES.includes(mode);
  }

  async createSession(input: { consultationId: string }): Promise<CommunicationSession> {
    // Derived from the consultation id so re-entering a session rejoins the
    // same room rather than creating a new one on every page load.
    return {
      sessionId: `dev-${input.consultationId}`,
      provider: this.name,
      createdAt: new Date(),
    };
  }

  async createParticipantToken(input: {
    sessionId: string;
    consultationId: string;
    identity: { userId: string; displayName: string; role: string };
    ttlSeconds: number;
  }): Promise<ParticipantToken> {
    const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000);

    const payload = [
      input.sessionId,
      input.identity.userId,
      input.identity.role,
      String(expiresAt.getTime()),
      randomUUID(),
    ].join(".");

    // Signed with the application's own secret. A development token is still a
    // real credential in the sense that it cannot be forged by a browser - the
    // lifecycle being exercised is the one production will use.
    const signature = createHmac("sha256", developmentSigningKey()).update(payload).digest("base64url");

    return {
      token: `${payload}.${signature}`,
      sessionId: input.sessionId,
      publicConfig: { provider: this.name, mode: "development" },
      expiresAt,
    };
  }

  async endSession(): Promise<void> {
    // Nothing to tear down: there is no external room.
  }

  async getSessionStatus(input: { sessionId: string }): Promise<SessionStatus> {
    return { sessionId: input.sessionId, state: "unknown", participantCount: null };
  }
}

function developmentSigningKey(): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new ProviderNotConfiguredError("development communication adapter");
    }
    return "development-only-insecure-secret-value";
  }
  return secret;
}

let cachedProvider: ConsultationCommunicationProvider | null = null;

/**
 * Resolves the configured provider.
 *
 * When calling credentials are present the intent is that a real adapter is
 * selected here. None is implemented yet, so this returns the development
 * adapter and reports itself as not production-connected - which is what the
 * status page and the session UI read.
 */
export function getCommunicationProvider(): ConsultationCommunicationProvider {
  cachedProvider ??= new DevelopmentCommunicationProvider();
  return cachedProvider;
}

/**
 * Whether a real calling provider is configured.
 *
 * Both halves of the credential must be present. A partially configured
 * provider is treated as unconfigured, for the same reason the payment config
 * refuses a half-filled bundle: a key id from one place and a secret from
 * another is a pair that never existed together.
 */
export async function isCallingConfigured(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const [appId, appSecret] = await Promise.all([
    getSecret("calls.appId", env),
    getSecret("calls.appSecret", env),
  ]);

  return Boolean(appId && appSecret);
}

export { PARTICIPANT_TOKEN_TTL_SECONDS };
