export interface PaymentProvider {
  createOrder(input: { amountPaise: number; currency: "INR"; receipt: string }): Promise<unknown>;
  verifyPayment(input: { orderId: string; paymentId: string; signature: string }): Promise<boolean>;
  refund(input: { paymentId: string; amountPaise?: number; reason?: string }): Promise<unknown>;
}
