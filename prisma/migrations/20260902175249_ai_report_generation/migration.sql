-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_orderId_fkey";

-- AlterTable
ALTER TABLE "GeneratedReport" ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiProvider" TEXT,
ADD COLUMN     "astrologyCalculationId" TEXT,
ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "document" JSONB,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "generatedAt" TIMESTAMP(3),
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastErrorAt" TIMESTAMP(3),
ADD COLUMN     "lastErrorCategory" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "promptVersion" TEXT,
ADD COLUMN     "readyAt" TIMESTAMP(3),
ADD COLUMN     "schemaVersion" TEXT,
ADD COLUMN     "status" "ReportStatus" NOT NULL DEFAULT 'QUEUED',
ALTER COLUMN "storageKey" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "GeneratedReport_status_idx" ON "GeneratedReport"("status");

-- CreateIndex
CREATE INDEX "GeneratedReport_astrologyCalculationId_idx" ON "GeneratedReport"("astrologyCalculationId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
