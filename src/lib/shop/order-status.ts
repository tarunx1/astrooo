import type { OrderStatus } from "@prisma/client";

/**
 * Customer-facing order status wording, centralised so list and detail views can
 * never drift apart. SHIPPED and DELIVERED are only ever set by an operator.
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Draft",
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  CONFIRMED: "Confirmed",
  PROCESSING: "Preparing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  FULFILLED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  DRAFT: "border-border text-foreground-muted",
  PENDING_PAYMENT: "border-border text-foreground-muted",
  PAID: "border-premium/50 text-premium",
  CONFIRMED: "border-premium/50 text-premium",
  PROCESSING: "border-border-strong text-foreground-secondary",
  SHIPPED: "border-primary/60 text-primary",
  DELIVERED: "border-success/50 text-success",
  FULFILLED: "border-success/50 text-success",
  CANCELLED: "border-danger/50 text-danger",
  REFUNDED: "border-danger/50 text-danger",
};
