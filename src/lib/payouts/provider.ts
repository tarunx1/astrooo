/**
 * The payout boundary.
 *
 * Disbursement logic talks to this interface, never to RazorpayX or Cashfree
 * directly, for the same reason the payment and communication providers are
 * behind interfaces: the ledger, the state machine and the audit trail should
 * not have to change when the transfer rail does.
 *
 * The rule this interface exists to enforce is stated in its return type: a
 * transfer request returns `PROCESSING`, never `PAID`. Having sent an API call
 * is not the same as the money having arrived, and a payout marked paid on
 * acceptance is a payout that will be reconciled wrong the first time a
 * provider rejects one downstream. Only a provider confirmation - a webhook or
 * a status poll - moves a payout to PAID.
 *
 * Kept free of `server-only` so the types can be shared; the implementations
 * that hold credentials are server-only themselves.
 */
export type PayoutDestination = {
  /** Opaque reference to the stored, encrypted destination. */
  panditProfileId: string;
  accountHolderName: string;
  /** Only the masked forms travel here; plaintext is resolved inside the adapter. */
  accountLast4: string | null;
  upiMasked: string | null;
};

export type PayoutTransferRequest = {
  payoutId: string;
  /** Integer minor units. No float ever touches a transfer. */
  amountMinor: number;
  currency: "INR";
  destination: PayoutDestination;
  /**
   * A caller-supplied key that must make a repeated request a no-op at the
   * provider. Without one, a retried transfer is a duplicate payment.
   */
  idempotencyKey: string;
  narration?: string;
};

/**
 * The outcome of *requesting* a transfer.
 *
 * Deliberately has no "paid" case. A provider accepting a request means it is
 * in flight, and the only truthful states at this point are accepted, rejected
 * outright, or an error that leaves the outcome unknown.
 */
export type PayoutTransferResult =
  | {
      status: "accepted";
      /** The provider's own identifier, persisted for reconciliation. */
      providerPayoutId: string;
      /** Provider's own status string, recorded verbatim for support. */
      providerStatus: string;
    }
  | { status: "rejected"; reason: string; providerPayoutId?: string }
  | {
      /**
       * The request may or may not have reached the provider. The caller must
       * not retry blindly - it must reconcile by idempotency key first.
       */
      status: "unknown";
      reason: string;
    };

export type PayoutStatusResult = {
  providerPayoutId: string;
  /** Mapped to the internal vocabulary by the adapter, not by the caller. */
  state: "processing" | "paid" | "failed" | "reversed" | "unknown";
  providerStatus: string;
  failureReason?: string;
  settledAt?: Date | null;
  /** The provider's bank reference, when it has issued one. */
  utr?: string | null;
};

export interface PayoutProvider {
  readonly name: string;

  /**
   * Whether this adapter can actually move money right now.
   *
   * False means the adapter exists but has no credentials. Callers must surface
   * that rather than letting an operator believe a transfer was sent.
   */
  readonly isProductionConnected: boolean;

  /** Requests a transfer. Returns `accepted`, never `paid`. */
  requestTransfer(request: PayoutTransferRequest): Promise<PayoutTransferResult>;

  /** Polls the provider for the current state of a transfer. */
  getTransferStatus(input: { providerPayoutId: string }): Promise<PayoutStatusResult>;

  /** Verifies a provider webhook before its contents are trusted. */
  verifyWebhookSignature(input: { rawBody: string; signature: string }): boolean;

  /** Parses a verified webhook into the internal status vocabulary. */
  parseWebhook(rawBody: string): PayoutStatusResult | null;
}

export class PayoutProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayoutProviderError";
  }
}

export class PayoutProviderNotConfiguredError extends PayoutProviderError {
  constructor(providerName: string) {
    super(`${providerName} is not configured on this deployment.`);
    this.name = "PayoutProviderNotConfiguredError";
  }
}

/**
 * A deterministic idempotency key for one payout.
 *
 * Derived from the payout id rather than generated per attempt, so a retry of
 * the same payout carries the same key and the provider collapses it. A random
 * key per attempt would defeat the entire mechanism.
 */
export function payoutIdempotencyKey(payoutId: string): string {
  return `payout_${payoutId}`;
}
