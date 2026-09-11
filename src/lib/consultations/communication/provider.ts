import type { ConsultationMode } from "@prisma/client";

/**
 * The consultation communication boundary.
 *
 * Business logic talks to this interface, never to Agora, Twilio, 100ms or
 * Daily directly. That is what makes the provider a decision rather than a
 * commitment: swapping one for another is implementing this interface, not
 * rewriting the session lifecycle, the authorization, or the UI states.
 *
 * The security property this interface exists to guarantee: a participant token
 * is minted on the server, is scoped to one participant in one session, and is
 * short-lived. The provider's app secret never leaves the server - there is no
 * method here that returns it, and no shape of client call that could.
 *
 * Kept free of `server-only` so the types can be shared with the UI; the
 * implementations that hold credentials are server-only themselves.
 */
export type SessionIdentity = {
  /** Internal user id. Becomes the provider's participant identity. */
  userId: string;
  /** Display name shown to the other participant. */
  displayName: string;
  role: "customer" | "pandit";
};

export type CommunicationSession = {
  /** The provider's identifier for the room or channel. */
  sessionId: string;
  provider: string;
  createdAt: Date;
};

export type ParticipantToken = {
  /** The short-lived credential the browser uses to join. Never the app secret. */
  token: string;
  sessionId: string;
  /** Everything the client SDK needs that is safe to publish. */
  publicConfig: Record<string, string>;
  expiresAt: Date;
};

export type SessionStatus = {
  sessionId: string;
  state: "not_started" | "active" | "ended" | "unknown";
  participantCount: number | null;
};

export interface ConsultationCommunicationProvider {
  /** A stable, human-meaningful name for status pages and logs. */
  readonly name: string;

  /**
   * Whether this provider can actually place a call right now.
   *
   * False means the adapter exists but has no credentials. Callers surface that
   * honestly rather than letting a customer walk into a session that cannot
   * connect.
   */
  readonly isProductionConnected: boolean;

  /** Which consultation modes this provider can carry. */
  supports(mode: ConsultationMode): boolean;

  createSession(input: {
    consultationId: string;
    mode: ConsultationMode;
  }): Promise<CommunicationSession>;

  createParticipantToken(input: {
    sessionId: string;
    consultationId: string;
    identity: SessionIdentity;
    mode: ConsultationMode;
    /** How long the token should remain valid. */
    ttlSeconds: number;
  }): Promise<ParticipantToken>;

  endSession(input: { sessionId: string }): Promise<void>;

  getSessionStatus(input: { sessionId: string }): Promise<SessionStatus>;
}

export class CommunicationProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommunicationProviderError";
  }
}

/** A provider is not configured; the caller must say so rather than pretend. */
export class ProviderNotConfiguredError extends CommunicationProviderError {
  constructor(providerName: string) {
    super(`${providerName} is not configured on this deployment.`);
    this.name = "ProviderNotConfiguredError";
  }
}

/** How long a participant token lives. Short, because it is re-mintable. */
export const PARTICIPANT_TOKEN_TTL_SECONDS = 60 * 15;
