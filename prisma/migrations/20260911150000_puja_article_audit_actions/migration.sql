-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PUJA_PANDIT_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE 'PUJA_BOOKING_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'PUJA_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'PUJA_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ARTICLE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ARTICLE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ARTICLE_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'ARTICLE_UNPUBLISHED';
