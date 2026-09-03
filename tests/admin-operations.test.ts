import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AuditAction,
  InventoryAdjustmentReason,
  InventoryStatus,
  OrderStatus,
  ProductType,
  ReportStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ADMIN_ROLES } from "@/lib/auth/admin";
import { adjustInventory, LOW_STOCK_THRESHOLD, inventoryStatusFor } from "@/lib/admin/inventory";
import { allowedNextStatuses, canTransition, transitionOrderStatus, updateShipmentDetails } from "@/lib/admin/order-transitions";
import { createProduct, productInputSchema, setProductActive, updateProduct } from "@/lib/admin/products";
import { changeUserRole, couponSchema, createCoupon, updateCoupon, updateReportDefinition } from "@/lib/admin/catalog-admin";
import { retryGeneratedReport } from "@/lib/admin/report-retry";
import { listAuditLog } from "@/lib/admin/audit";

/**
 * Admin operations against real Postgres.
 *
 * These exist to prove the properties that matter: that historical financial
 * snapshots survive catalogue edits, that stock cannot go negative, that only
 * declared transitions are possible, and that every sensitive action is audited.
 */
const RUN = `adm${Date.now().toString(36)}`;

let admin: { id: string };
let customer: { id: string };

async function createUser(label: string, role: UserRole) {
  return prisma.user.create({
    data: { name: `Admin ${label}`, email: `${RUN}.${label}@example.test`, emailVerified: true, role },
    select: { id: true },
  });
}

async function createProductWithStock(slug: string, pricePaise: number, quantity: number) {
  const product = await prisma.product.create({
    data: {
      slug: `${RUN}-${slug}`,
      title: `Test ${slug}`,
      description: "A test product for admin operations.",
      type: ProductType.PHYSICAL,
      pricePaise,
      currency: "INR",
      sku: `${RUN}-${slug}`.toUpperCase(),
      active: true,
    },
    select: { id: true },
  });

  await prisma.inventory.create({
    data: {
      productId: product.id,
      quantity,
      status: quantity > 0 ? InventoryStatus.IN_STOCK : InventoryStatus.OUT_OF_STOCK,
    },
  });

  return product.id;
}

async function createPaidOrder(productId: string, unitPricePaise: number) {
  const order = await prisma.order.create({
    data: {
      orderNumber: `${RUN}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      userId: customer.id,
      status: OrderStatus.PAID,
      paidAt: new Date(),
      subtotalPaise: unitPricePaise,
      totalPaise: unitPricePaise,
      currency: "INR",
      shippingAddress: { city: "Amritsar", postalCode: "143001" },
    },
    select: { id: true },
  });

  await prisma.orderItem.create({
    data: {
      orderId: order.id,
      productId,
      title: "Snapshot Title At Purchase",
      skuSnapshot: "SNAP-SKU",
      quantity: 1,
      unitPricePaise,
      totalPaise: unitPricePaise,
    },
  });

  return order.id;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  admin = await createUser("admin", UserRole.ADMIN);
  await createUser("admin2", UserRole.ADMIN);
  customer = await createUser("customer", UserRole.CUSTOMER);
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { startsWith: `${RUN}.` } }, select: { id: true } });
  const ids = users.map((user) => user.id);

  await prisma.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
  await prisma.inventoryAdjustment.deleteMany({ where: { adminUserId: { in: ids } } });
  await prisma.orderItem.deleteMany({ where: { order: { userId: { in: ids } } } });
  await prisma.order.deleteMany({ where: { userId: { in: ids } } });
  // Report rows created by the retry tests must go before their users.
  await prisma.generatedReport.deleteMany({ where: { reportOrder: { userId: { in: ids } } } });
  await prisma.reportOrder.deleteMany({ where: { userId: { in: ids } } });
  await prisma.reportDefinition.deleteMany({ where: { slug: { startsWith: RUN } } });
  await prisma.inventory.deleteMany({ where: { product: { slug: { startsWith: RUN } } } });
  await prisma.productImage.deleteMany({ where: { product: { slug: { startsWith: RUN } } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: RUN } } });
  await prisma.coupon.deleteMany({ where: { code: { startsWith: RUN.toUpperCase() } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe("admin role model", () => {
  it("treats only ADMIN and SUPER_ADMIN as privileged", () => {
    expect(ADMIN_ROLES).toContain(UserRole.ADMIN);
    expect(ADMIN_ROLES).toContain(UserRole.SUPER_ADMIN);
    expect(ADMIN_ROLES).not.toContain(UserRole.CUSTOMER);
    expect(ADMIN_ROLES).not.toContain(UserRole.EDITOR);
    expect(ADMIN_ROLES).not.toContain(UserRole.ASTROLOGER);
  });
});

describe("product management", () => {
  it("creates a product with zero stock and records an audit entry", async () => {
    const input = productInputSchema.parse({
      title: "Admin Created Stone",
      slug: `${RUN}-created`,
      description: "A stone created through the admin interface for testing.",
      pricePaise: 250_000,
      active: false,
    });

    const result = await createProduct(admin.id, input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const created = await prisma.product.findUnique({
      where: { id: result.productId },
      select: { active: true, pricePaise: true, inventory: { select: { quantity: true } } },
    });

    expect(created?.active).toBe(false);
    expect(created?.pricePaise).toBe(250_000);
    expect(created?.inventory?.quantity).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: result.productId, action: AuditAction.PRODUCT_CREATED },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects a sale price at or above the regular price", () => {
    const parsed = productInputSchema.safeParse({
      title: "Bad Pricing",
      slug: `${RUN}-bad`,
      description: "A description long enough to pass validation.",
      pricePaise: 100_000,
      salePricePaise: 100_000,
      active: true,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects a malformed slug", () => {
    const parsed = productInputSchema.safeParse({
      title: "Bad Slug",
      slug: "Not A Slug!",
      description: "A description long enough to pass validation.",
      pricePaise: 100_000,
      active: true,
    });

    expect(parsed.success).toBe(false);
  });

  it("leaves a historical order untouched when the product price changes", async () => {
    const productId = await createProductWithStock(`histprice-${Date.now()}`, 100_000, 5);
    const orderId = await createPaidOrder(productId, 100_000);

    const before = await prisma.order.findUnique({
      where: { id: orderId },
      select: { totalPaise: true, items: { select: { title: true, unitPricePaise: true, totalPaise: true } } },
    });

    const result = await updateProduct(
      admin.id,
      productId,
      productInputSchema.parse({
        title: "Renamed After The Sale",
        slug: `${RUN}-histprice-renamed-${Date.now()}`,
        description: "The catalogue entry changed after a customer already bought it.",
        pricePaise: 450_000,
        active: true,
      }),
    );
    expect(result.ok).toBe(true);

    const after = await prisma.order.findUnique({
      where: { id: orderId },
      select: { totalPaise: true, items: { select: { title: true, unitPricePaise: true, totalPaise: true } } },
    });

    // The catalogue moved from 1,000 to 4,500 rupees; the order did not.
    expect(after).toEqual(before);
    expect(after?.items[0].unitPricePaise).toBe(100_000);
    expect(after?.items[0].title).toBe("Snapshot Title At Purchase");
    expect(after?.totalPaise).toBe(100_000);
  });

  it("audits a price change separately so it is findable", async () => {
    const productId = await createProductWithStock(`auditprice-${Date.now()}`, 100_000, 1);

    await updateProduct(
      admin.id,
      productId,
      productInputSchema.parse({
        title: "Price Audit Product",
        slug: `${RUN}-auditprice-new-${Date.now()}`,
        description: "Changing the price should leave a dedicated audit trail entry.",
        pricePaise: 175_000,
        active: true,
      }),
    );

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: productId, action: AuditAction.PRODUCT_PRICE_CHANGED },
    });

    expect(audit).not.toBeNull();
    expect((audit?.metadata as Record<string, unknown>)?.fromPricePaise).toBe(100_000);
    expect((audit?.metadata as Record<string, unknown>)?.toPricePaise).toBe(175_000);
  });

  it("deactivates a product without touching its order history", async () => {
    const productId = await createProductWithStock(`deact-${Date.now()}`, 90_000, 2);
    const orderId = await createPaidOrder(productId, 90_000);

    const result = await setProductActive(admin.id, productId, false);
    expect(result.ok).toBe(true);

    const product = await prisma.product.findUnique({ where: { id: productId }, select: { active: true } });
    expect(product?.active).toBe(false);

    // The order and its line survive intact.
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { items: { select: { unitPricePaise: true } } },
    });
    expect(order?.items).toHaveLength(1);
    expect(order?.items[0].unitPricePaise).toBe(90_000);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: productId, action: AuditAction.PRODUCT_DEACTIVATED },
    });
    expect(audit).not.toBeNull();
  });
});

describe("inventory", () => {
  it("derives status from quantity against the central threshold", () => {
    expect(inventoryStatusFor(0)).toBe(InventoryStatus.OUT_OF_STOCK);
    expect(inventoryStatusFor(LOW_STOCK_THRESHOLD)).toBe(InventoryStatus.LOW_STOCK);
    expect(inventoryStatusFor(LOW_STOCK_THRESHOLD + 1)).toBe(InventoryStatus.IN_STOCK);
  });

  it("applies a positive adjustment and records why", async () => {
    const productId = await createProductWithStock(`adjust-${Date.now()}`, 50_000, 2);

    const result = await adjustInventory({
      adminUserId: admin.id,
      target: { productId },
      delta: 10,
      reason: InventoryAdjustmentReason.RESTOCK,
      note: "Delivery received",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.previousQuantity).toBe(2);
    expect(result.newQuantity).toBe(12);

    const inventory = await prisma.inventory.findUnique({ where: { productId }, select: { quantity: true, status: true } });
    expect(inventory?.quantity).toBe(12);
    expect(inventory?.status).toBe(InventoryStatus.IN_STOCK);

    const adjustment = await prisma.inventoryAdjustment.findUnique({
      where: { id: result.adjustmentId },
      select: { delta: true, previousQuantity: true, newQuantity: true, reason: true, adminUserId: true, note: true },
    });

    expect(adjustment).toMatchObject({
      delta: 10,
      previousQuantity: 2,
      newQuantity: 12,
      reason: InventoryAdjustmentReason.RESTOCK,
      adminUserId: admin.id,
      note: "Delivery received",
    });

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: productId, action: AuditAction.INVENTORY_ADJUSTED },
    });
    expect(audit).not.toBeNull();
  });

  it("refuses an adjustment that would take stock below zero", async () => {
    const productId = await createProductWithStock(`negative-${Date.now()}`, 50_000, 3);

    const result = await adjustInventory({
      adminUserId: admin.id,
      target: { productId },
      delta: -4,
      reason: InventoryAdjustmentReason.CORRECTION,
    });

    expect(result).toMatchObject({ ok: false, reason: "would_go_negative" });

    // Nothing changed, and nothing was recorded.
    const inventory = await prisma.inventory.findUnique({ where: { productId }, select: { quantity: true } });
    expect(inventory?.quantity).toBe(3);

    const adjustments = await prisma.inventoryAdjustment.count({ where: { productId } });
    expect(adjustments).toBe(0);
  });

  it("refuses a zero adjustment", async () => {
    const productId = await createProductWithStock(`zero-${Date.now()}`, 50_000, 3);

    const result = await adjustInventory({
      adminUserId: admin.id,
      target: { productId },
      delta: 0,
      reason: InventoryAdjustmentReason.MANUAL,
    });

    expect(result).toMatchObject({ ok: false, reason: "no_change" });
  });

  it("flips to out of stock when the last unit leaves", async () => {
    const productId = await createProductWithStock(`lastunit-${Date.now()}`, 50_000, 2);

    await adjustInventory({
      adminUserId: admin.id,
      target: { productId },
      delta: -2,
      reason: InventoryAdjustmentReason.DAMAGED,
    });

    const inventory = await prisma.inventory.findUnique({ where: { productId }, select: { quantity: true, status: true } });
    expect(inventory?.quantity).toBe(0);
    expect(inventory?.status).toBe(InventoryStatus.OUT_OF_STOCK);
  });

  it("applies concurrent adjustments without losing one", async () => {
    const productId = await createProductWithStock(`race-${Date.now()}`, 50_000, 10);

    const outcomes = await Promise.all([
      adjustInventory({ adminUserId: admin.id, target: { productId }, delta: 5, reason: InventoryAdjustmentReason.RESTOCK }),
      adjustInventory({ adminUserId: admin.id, target: { productId }, delta: 5, reason: InventoryAdjustmentReason.RESTOCK }),
    ]);

    const applied = outcomes.filter((outcome) => outcome.ok).length;
    const inventory = await prisma.inventory.findUnique({ where: { productId }, select: { quantity: true } });

    // Either both applied (20) or one lost the guard and was refused (15).
    // What must never happen is a lost update reporting success.
    expect(inventory?.quantity).toBe(10 + applied * 5);
  });
});

describe("order fulfilment transitions", () => {
  it("never allows an operator to create a payment fact", () => {
    // PENDING_PAYMENT has no outgoing transitions at all.
    expect(allowedNextStatuses(OrderStatus.PENDING_PAYMENT)).toHaveLength(0);
    expect(canTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.PAID)).toBe(false);
  });

  it("permits only the declared forward path", () => {
    expect(canTransition(OrderStatus.PAID, OrderStatus.PROCESSING)).toBe(true);
    expect(canTransition(OrderStatus.PROCESSING, OrderStatus.SHIPPED)).toBe(true);
    expect(canTransition(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(true);
  });

  it("refuses backwards and skipping transitions", () => {
    expect(canTransition(OrderStatus.DELIVERED, OrderStatus.PENDING_PAYMENT)).toBe(false);
    expect(canTransition(OrderStatus.DELIVERED, OrderStatus.SHIPPED)).toBe(false);
    expect(canTransition(OrderStatus.PAID, OrderStatus.DELIVERED)).toBe(false);
    expect(canTransition(OrderStatus.SHIPPED, OrderStatus.CANCELLED)).toBe(false);
  });

  it("stamps a timestamp on each step and audits the change", async () => {
    const productId = await createProductWithStock(`flow-${Date.now()}`, 120_000, 4);
    const orderId = await createPaidOrder(productId, 120_000);

    const toProcessing = await transitionOrderStatus({ adminUserId: admin.id, orderId, to: OrderStatus.PROCESSING });
    expect(toProcessing).toMatchObject({ ok: true, from: OrderStatus.PAID, to: OrderStatus.PROCESSING });

    await transitionOrderStatus({ adminUserId: admin.id, orderId, to: OrderStatus.SHIPPED });
    await transitionOrderStatus({ adminUserId: admin.id, orderId, to: OrderStatus.DELIVERED });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, processingAt: true, shippedAt: true, deliveredAt: true, paidAt: true },
    });

    expect(order?.status).toBe(OrderStatus.DELIVERED);
    expect(order?.processingAt).not.toBeNull();
    expect(order?.shippedAt).not.toBeNull();
    expect(order?.deliveredAt).not.toBeNull();
    expect(order?.paidAt).not.toBeNull();

    const audits = await prisma.auditLog.count({
      where: { entityId: orderId, action: AuditAction.ORDER_STATUS_CHANGED },
    });
    expect(audits).toBe(3);
  });

  it("refuses an invalid transition at the service boundary, not just in the UI", async () => {
    const productId = await createProductWithStock(`invalid-${Date.now()}`, 120_000, 2);
    const orderId = await createPaidOrder(productId, 120_000);

    const result = await transitionOrderStatus({ adminUserId: admin.id, orderId, to: OrderStatus.DELIVERED });
    expect(result).toMatchObject({ ok: false, reason: "invalid_transition" });

    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
    expect(order?.status).toBe(OrderStatus.PAID);
  });

  it("never alters financial fields when fulfilment moves", async () => {
    const productId = await createProductWithStock(`fin-${Date.now()}`, 200_000, 2);
    const orderId = await createPaidOrder(productId, 200_000);

    const before = await prisma.order.findUnique({
      where: { id: orderId },
      select: { totalPaise: true, subtotalPaise: true, currency: true, paidAt: true },
    });

    await transitionOrderStatus({ adminUserId: admin.id, orderId, to: OrderStatus.PROCESSING });
    await updateShipmentDetails({
      adminUserId: admin.id,
      orderId,
      carrierName: "Test Carrier",
      trackingNumber: "TRACK123",
      trackingUrl: "https://example.test/track",
    });

    const after = await prisma.order.findUnique({
      where: { id: orderId },
      select: { totalPaise: true, subtotalPaise: true, currency: true, paidAt: true, carrierName: true, trackingNumber: true },
    });

    expect(after?.totalPaise).toBe(before?.totalPaise);
    expect(after?.subtotalPaise).toBe(before?.subtotalPaise);
    expect(after?.currency).toBe(before?.currency);
    expect(after?.paidAt?.toISOString()).toBe(before?.paidAt?.toISOString());
    expect(after?.carrierName).toBe("Test Carrier");
    expect(after?.trackingNumber).toBe("TRACK123");
  });
});

describe("coupons", () => {
  it("requires exactly one of percentage or fixed amount", () => {
    const both = couponSchema.safeParse({ code: "BOTH", percentOff: 10, amountOffPaise: 5000, active: true });
    const neither = couponSchema.safeParse({ code: "NEITHER", active: true });

    expect(both.success).toBe(false);
    expect(neither.success).toBe(false);
  });

  it("creates and deactivates a coupon with an audit trail", async () => {
    const created = await createCoupon(
      admin.id,
      couponSchema.parse({ code: `${RUN.toUpperCase()}NEW`, percentOff: 20, active: true }),
    );

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const deactivated = await updateCoupon(
      admin.id,
      created.couponId,
      couponSchema.parse({ code: `${RUN.toUpperCase()}NEW`, percentOff: 20, active: false }),
    );
    expect(deactivated.ok).toBe(true);

    const coupon = await prisma.coupon.findUnique({ where: { id: created.couponId }, select: { active: true } });
    expect(coupon?.active).toBe(false);

    const audits = await prisma.auditLog.findMany({
      where: { entityId: created.couponId },
      select: { action: true },
    });
    const actions = audits.map((entry) => entry.action);
    expect(actions).toContain(AuditAction.COUPON_CREATED);
    expect(actions).toContain(AuditAction.COUPON_DEACTIVATED);
  });

  it("refuses to change a coupon code, because orders snapshot it", async () => {
    const created = await createCoupon(
      admin.id,
      couponSchema.parse({ code: `${RUN.toUpperCase()}FIXED`, amountOffPaise: 5000, active: true }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const renamed = await updateCoupon(
      admin.id,
      created.couponId,
      couponSchema.parse({ code: `${RUN.toUpperCase()}RENAMED`, amountOffPaise: 5000, active: true }),
    );

    expect(renamed).toMatchObject({ ok: false });
  });

  it("preserves the redemption counter across an edit", async () => {
    const created = await createCoupon(
      admin.id,
      couponSchema.parse({ code: `${RUN.toUpperCase()}COUNT`, percentOff: 15, active: true }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await prisma.coupon.update({ where: { id: created.couponId }, data: { timesRedeemed: 7 } });

    await updateCoupon(
      admin.id,
      created.couponId,
      couponSchema.parse({ code: `${RUN.toUpperCase()}COUNT`, percentOff: 25, active: true }),
    );

    const coupon = await prisma.coupon.findUnique({ where: { id: created.couponId }, select: { timesRedeemed: true, percentOff: true } });
    expect(coupon?.timesRedeemed).toBe(7);
    expect(coupon?.percentOff).toBe(25);
  });
});

describe("user roles", () => {
  it("refuses a self role change", async () => {
    const result = await changeUserRole({ adminUserId: admin.id, targetUserId: admin.id, role: UserRole.SUPER_ADMIN });
    expect(result).toMatchObject({ ok: false });
  });

  it("promotes another user and audits it", async () => {
    const result = await changeUserRole({ adminUserId: admin.id, targetUserId: customer.id, role: UserRole.EDITOR });
    expect(result.ok).toBe(true);

    const updated = await prisma.user.findUnique({ where: { id: customer.id }, select: { role: true } });
    expect(updated?.role).toBe(UserRole.EDITOR);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: customer.id, action: AuditAction.USER_ROLE_CHANGED },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
    expect((audit?.metadata as Record<string, unknown>)?.to).toBe(UserRole.EDITOR);

    // Restore for later assertions.
    await prisma.user.update({ where: { id: customer.id }, data: { role: UserRole.CUSTOMER } });
  });

  it("refuses to demote the last remaining admin", async () => {
    // Isolate: temporarily demote every other admin so only one remains.
    const others = await prisma.user.findMany({
      where: { role: { in: [...ADMIN_ROLES] }, id: { notIn: [admin.id] } },
      select: { id: true, role: true },
    });

    await prisma.user.updateMany({
      where: { id: { in: others.map((user) => user.id) } },
      data: { role: UserRole.CUSTOMER },
    });

    const attacker = await createUser(`temp-${Date.now()}`, UserRole.ADMIN);
    // Now two admins exist: `admin` and `attacker`. Demote attacker first.
    await prisma.user.update({ where: { id: attacker.id }, data: { role: UserRole.CUSTOMER } });

    const result = await changeUserRole({
      adminUserId: attacker.id,
      targetUserId: admin.id,
      role: UserRole.CUSTOMER,
    });

    expect(result).toMatchObject({ ok: false });
    expect((result as { message: string }).message).toContain("last admin");

    // Restore.
    await prisma.user.updateMany({
      where: { id: { in: others.map((user) => user.id) } },
      data: { role: UserRole.ADMIN },
    });
  });
});

describe("report generation retry", () => {
  async function createFailedReport(attemptCount: number) {
    const definition = await prisma.reportDefinition.create({
      data: {
        slug: `${RUN}-def-${Math.random().toString(36).slice(2, 8)}`,
        name: "Retry Test Report",
        shortDescription: "For retry tests.",
        description: "A definition used only by the retry tests.",
        priceMinor: 49_900,
        currency: "INR",
        estimatedPages: 10,
        sectionsIncluded: [],
        requiredInputs: [],
        reportType: "CAREER",
        requiredFields: [],
        sections: [],
      },
      select: { id: true },
    });

    const order = await prisma.reportOrder.create({
      data: {
        userId: customer.id,
        reportDefinitionId: definition.id,
        status: ReportStatus.FAILED,
        paidAt: new Date(),
        priceMinor: 49_900,
        currency: "INR",
        reportNameSnapshot: "Retry Test Report",
        reportSlugSnapshot: "career",
        priceSnapshot: 49_900,
        currencySnapshot: "INR",
        inputSnapshot: {},
      },
      select: { id: true, priceSnapshot: true, paidAt: true },
    });

    const generated = await prisma.generatedReport.create({
      data: {
        reportOrderId: order.id,
        status: ReportStatus.FAILED,
        attemptCount,
        lastError: "boom",
        lastErrorCategory: "transient",
        lastErrorAt: new Date(),
      },
      select: { id: true },
    });

    return { definitionId: definition.id, orderId: order.id, generatedId: generated.id, order };
  }

  it("re-queues a failed report without charging again or losing the snapshot", async () => {
    const { orderId, generatedId, order } = await createFailedReport(1);

    const result = await retryGeneratedReport({ adminUserId: admin.id, generatedReportId: generatedId });
    expect(result).toMatchObject({ ok: true });

    const report = await prisma.generatedReport.findUnique({
      where: { id: generatedId },
      select: { status: true, attemptCount: true, lastError: true, lastErrorCategory: true },
    });

    expect(report?.status).toBe(ReportStatus.QUEUED);
    // Attempt history is preserved, not reset.
    expect(report?.attemptCount).toBe(1);
    expect(report?.lastError).toBeNull();

    const reportOrder = await prisma.reportOrder.findUnique({
      where: { id: orderId },
      select: { status: true, priceSnapshot: true, paidAt: true },
    });

    expect(reportOrder?.status).toBe(ReportStatus.PAID);
    expect(reportOrder?.priceSnapshot).toBe(order.priceSnapshot);
    expect(reportOrder?.paidAt?.toISOString()).toBe(order.paidAt?.toISOString());

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: generatedId, action: AuditAction.REPORT_GENERATION_RETRIED },
    });
    expect(audit).not.toBeNull();
  });

  it("refuses to regenerate a report that is already delivered", async () => {
    const { generatedId } = await createFailedReport(1);

    await prisma.generatedReport.update({
      where: { id: generatedId },
      data: { status: ReportStatus.READY, storageKey: "reports/test.pdf" },
    });

    const result = await retryGeneratedReport({ adminUserId: admin.id, generatedReportId: generatedId });
    expect(result).toMatchObject({ ok: false, reason: "already_ready" });
  });

  it("refuses a retry once the automatic attempt budget is spent", async () => {
    const { generatedId } = await createFailedReport(3);

    const result = await retryGeneratedReport({ adminUserId: admin.id, generatedReportId: generatedId });
    expect(result).toMatchObject({ ok: false, reason: "exhausted" });
  });

  it("refuses to retry an unknown report", async () => {
    const result = await retryGeneratedReport({ adminUserId: admin.id, generatedReportId: "does-not-exist" });
    expect(result).toMatchObject({ ok: false, reason: "not_found" });
  });
});

describe("report definitions", () => {
  it("does not alter a historical report order snapshot when the catalogue changes", async () => {
    const definition = await prisma.reportDefinition.create({
      data: {
        slug: `${RUN}-snapdef`,
        name: "Original Report Name",
        shortDescription: "Original short description.",
        description: "The original long description for this report definition.",
        priceMinor: 99_900,
        currency: "INR",
        estimatedPages: 20,
        sectionsIncluded: [],
        requiredInputs: [],
        reportType: "CAREER",
        requiredFields: [],
        sections: [],
      },
      select: { id: true },
    });

    const order = await prisma.reportOrder.create({
      data: {
        userId: customer.id,
        reportDefinitionId: definition.id,
        status: ReportStatus.PAID,
        paidAt: new Date(),
        priceMinor: 99_900,
        currency: "INR",
        reportNameSnapshot: "Original Report Name",
        reportSlugSnapshot: "career",
        priceSnapshot: 99_900,
        currencySnapshot: "INR",
        inputSnapshot: {},
      },
      select: { id: true },
    });

    await updateReportDefinition(admin.id, definition.id, {
      name: "Renamed Report",
      shortDescription: "A completely different short description now.",
      description: "The description was rewritten well after this order was placed.",
      priceMinor: 249_900,
      estimatedPages: 40,
      sortOrder: 1,
      isActive: true,
      sectionsIncluded: ["New section"],
    });

    const after = await prisma.reportOrder.findUnique({
      where: { id: order.id },
      select: { reportNameSnapshot: true, priceSnapshot: true, priceMinor: true },
    });

    expect(after?.reportNameSnapshot).toBe("Original Report Name");
    expect(after?.priceSnapshot).toBe(99_900);
    expect(after?.priceMinor).toBe(99_900);

    await prisma.reportOrder.delete({ where: { id: order.id } });
    await prisma.reportDefinition.delete({ where: { id: definition.id } });
  });
});

describe("audit log", () => {
  it("lists recent entries with their actor", async () => {
    const { entries, total } = await listAuditLog({ page: 1, pageSize: 5 });

    expect(total).toBeGreaterThan(0);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].actorEmail).toBeTruthy();
    expect(entries[0].action).toBeTruthy();
  });

  it("never records a secret in its metadata", async () => {
    const { entries } = await listAuditLog({ page: 1, pageSize: 50 });

    for (const entry of entries) {
      const serialised = JSON.stringify(entry.metadata ?? {}).toLowerCase();
      expect(serialised, entry.action).not.toContain("secret");
      expect(serialised, entry.action).not.toContain("password");
      expect(serialised, entry.action).not.toContain("token");
      expect(serialised, entry.action).not.toContain("apikey");
    }
  });
});
