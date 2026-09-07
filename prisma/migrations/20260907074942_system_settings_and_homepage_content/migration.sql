
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'SYSTEM_SETTING_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SYSTEM_SECRET_REPLACED';
ALTER TYPE "AuditAction" ADD VALUE 'SYSTEM_SECRET_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'PROVIDER_ENABLED';
ALTER TYPE "AuditAction" ADD VALUE 'PROVIDER_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE 'PROVIDER_TESTED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_MODE_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'HOMEPAGE_CONTENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'HOMEPAGE_SECTION_TOGGLED';
ALTER TYPE "AuditAction" ADD VALUE 'NAVIGATION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'FEATURE_SETTING_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SUPER_ADMIN_PROMOTED';
ALTER TYPE "AuditAction" ADD VALUE 'SUPER_ADMIN_DEMOTED';

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSecret" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "envelope" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomepageSection" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "contentJson" JSONB,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "SystemSetting_category_idx" ON "SystemSetting"("category");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSecret_key_key" ON "SystemSecret"("key");

-- CreateIndex
CREATE UNIQUE INDEX "HomepageSection_key_key" ON "HomepageSection"("key");

-- CreateIndex
CREATE INDEX "HomepageSection_sortOrder_idx" ON "HomepageSection"("sortOrder");

