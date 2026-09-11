-- Consultation checkout: payment linkage and the commission snapshot.
--
-- Every change here is additive and nullable, so no existing Consultation or
-- Payment row is rewritten and nothing needs backfilling:
--
--  * Two values are appended to ConsultationStatus. No existing row changes
--    status, and REQUESTED keeps its meaning for bookings made before paid
--    checkout existed.
--
--  * The commission columns are nullable on purpose. A consultation booked
--    before this migration has no snapshot, and settlement falls back to the
--    platform default for exactly those rows rather than inventing a number.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConsultationStatus" ADD VALUE 'PENDING_PAYMENT';
ALTER TYPE "ConsultationStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "commissionPercent" INTEGER,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "panditEarningPaise" INTEGER,
ADD COLUMN     "platformCommissionPaise" INTEGER,
ADD COLUMN     "providerOrderId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "consultationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_providerOrderId_key" ON "Consultation"("providerOrderId");

-- CreateIndex
CREATE INDEX "Payment_consultationId_idx" ON "Payment"("consultationId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
