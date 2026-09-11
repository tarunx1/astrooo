-- Puja marketplace: catalogue detail, booking lifecycle and payment linkage.
--
-- Safety notes:
--
--  * Puja and PujaBooking were scaffold tables that no application code read or
--    wrote, and both are verified empty before this runs. That is what makes
--    the NOT NULL columns on PujaBooking (bookingNumber, pricePaise,
--    titleSnapshot) safe without a backfill. On any database where those tables
--    hold rows, stop and backfill first rather than forcing this through.
--
--  * PujaBooking.status changes from a free-form string to an enum, and
--    PujaBooking.date is replaced by scheduledAt/requestedDate. Both are
--    rewrites rather than additions, which is only acceptable because the table
--    is empty.
--
--  * Every column added to Puja is nullable or carries a default, so an
--    existing catalogue row would survive unchanged.
--
--  * Payment gains a nullable pujaBookingId, exactly as it gained
--    consultationId. No existing payment row is touched.

-- CreateEnum
CREATE TYPE "PujaMode" AS ENUM ('ONLINE', 'IN_PERSON', 'TEMPLE');

-- CreateEnum
CREATE TYPE "PujaBookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'PANDIT_PENDING', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "pujaBookingId" TEXT;

-- AlterTable
ALTER TABLE "Puja" ADD COLUMN     "benefits" TEXT[],
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "imageUrls" TEXT[],
ADD COLUMN     "modes" "PujaMode"[],
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "requirements" TEXT[],
ADD COLUMN     "samagri" JSONB,
ADD COLUMN     "shortDescription" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vidhi" JSONB;

-- AlterTable
ALTER TABLE "PujaBooking" DROP COLUMN "date",
ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedById" TEXT,
ADD COLUMN     "bookingNumber" TEXT NOT NULL,
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "mode" "PujaMode" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "operatorNote" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "panditProfileId" TEXT,
ADD COLUMN     "pricePaise" INTEGER NOT NULL,
ADD COLUMN     "providerOrderId" TEXT,
ADD COLUMN     "requestedDate" TIMESTAMP(3),
ADD COLUMN     "sankalpJson" JSONB,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
ADD COLUMN     "titleSnapshot" TEXT NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "PujaBookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT';

-- CreateIndex
CREATE INDEX "Payment_pujaBookingId_idx" ON "Payment"("pujaBookingId");

-- CreateIndex
CREATE INDEX "Puja_active_sortOrder_idx" ON "Puja"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PujaBooking_bookingNumber_key" ON "PujaBooking"("bookingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PujaBooking_providerOrderId_key" ON "PujaBooking"("providerOrderId");

-- CreateIndex
CREATE INDEX "PujaBooking_status_idx" ON "PujaBooking"("status");

-- CreateIndex
CREATE INDEX "PujaBooking_panditProfileId_idx" ON "PujaBooking"("panditProfileId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_pujaBookingId_fkey" FOREIGN KEY ("pujaBookingId") REFERENCES "PujaBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PujaBooking" ADD CONSTRAINT "PujaBooking_panditProfileId_fkey" FOREIGN KEY ("panditProfileId") REFERENCES "PanditProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PujaBooking" ADD CONSTRAINT "PujaBooking_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
