export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string = "PAYMENT_PROVIDER_ERROR",
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}

export class PaymentValidationError extends PaymentProviderError {
  constructor(message = "Payment validation failed.") {
    super(message, "PAYMENT_VALIDATION_ERROR");
    this.name = "PaymentValidationError";
  }
}

export class PaymentSignatureError extends PaymentProviderError {
  constructor(message = "Payment signature verification failed.") {
    super(message, "PAYMENT_SIGNATURE_ERROR");
    this.name = "PaymentSignatureError";
  }
}

export class PaymentUnavailableError extends PaymentProviderError {
  constructor(message = "Payment service is not configured.") {
    super(message, "PAYMENT_UNAVAILABLE");
    this.name = "PaymentUnavailableError";
  }
}

export class PaymentRateLimitError extends PaymentProviderError {
  constructor(message = "Payment service is rate limited.") {
    super(message, "PAYMENT_RATE_LIMITED");
    this.name = "PaymentRateLimitError";
  }
}
