-- CreateEnum
CREATE TYPE "InventoryAdjustmentReason" AS ENUM ('RESTOCK', 'CORRECTION', 'DAMAGED', 'RETURN', 'MANUAL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_PRICE_CHANGED', 'PRODUCT_ACTIVATED', 'PRODUCT_DEACTIVATED', 'PRODUCT_VARIANT_CREATED', 'PRODUCT_VARIANT_UPDATED', 'INVENTORY_ADJUSTED', 'ORDER_STATUS_CHANGED', 'ORDER_SHIPMENT_UPDATED', 'REPORT_DEFINITION_UPDATED', 'REPORT_DEFINITION_ACTIVATED', 'REPORT_DEFINITION_DEACTIVATED', 'REPORT_GENERATION_RETRIED', 'COUPON_CREATED', 'COUPON_UPDATED', 'COUPON_ACTIVATED', 'COUPON_DEACTIVATED', 'USER_ROLE_CHANGED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "carrierName" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "processingAt" TIMESTAMP(3),
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "trackingNumber" TEXT,
ADD COLUMN     "trackingUrl" TEXT;

-- CreateTable
CREATE TABLE "InventoryAdjustment" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "productVariantId" TEXT,
    "adminUserId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "previousQuantity" INTEGER NOT NULL,
    "newQuantity" INTEGER NOT NULL,
    "reason" "InventoryAdjustmentReason" NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryAdjustment_productId_idx" ON "InventoryAdjustment"("productId");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_productVariantId_idx" ON "InventoryAdjustment"("productVariantId");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_createdAt_idx" ON "InventoryAdjustment"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

