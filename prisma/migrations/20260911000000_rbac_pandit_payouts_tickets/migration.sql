-- Role-based access control, Pandit onboarding, consultations, earnings,
-- payouts and support tickets.
--
-- Safety notes for this migration:
--
--  * Astrologer, ConsultationSlot and Consultation were scaffold tables that no
--    application code ever read or wrote. They are verified empty before this
--    runs, which is what makes the NOT NULL columns added below safe without a
--    backfill. On any database where those tables hold rows, stop and backfill
--    first rather than forcing this through.
--
--  * Every column added to an existing, populated table (User, Product,
--    BirthProfile, Order) is either nullable or carries a default, so no
--    existing account, product or order is altered.
--
--  * No existing user's role changes. EMPLOYEE and PANDIT are appended to the
--    UserRole enum and assigned to nobody; the default stays CUSTOMER.

-- CreateEnum
CREATE TYPE "PanditOnboardingStatus" AS ENUM ('REQUESTED', 'PROFILE_STARTED', 'DOCUMENTS_PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'VERIFIED', 'APPROVED', 'PROFILE_COMPLETION_REQUIRED', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ConsultationMode" AS ENUM ('CHAT', 'VOICE_CALL', 'VIDEO_CALL');

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('PER_MINUTE', 'FIXED_SESSION');

-- CreateEnum
CREATE TYPE "PanditDocumentType" AS ENUM ('IDENTITY', 'ADDRESS', 'CERTIFICATE', 'EXPERIENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "PanditDocumentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PanditReviewDecision" AS ENUM ('SUBMITTED', 'REVIEW_STARTED', 'CHANGES_REQUESTED', 'VERIFIED', 'APPROVED', 'ACTIVATED', 'REJECTED', 'SUSPENDED', 'REINSTATED');

-- CreateEnum
CREATE TYPE "EarningStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'PROCESSING', 'PAID', 'FAILED', 'HELD', 'REVERSED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'PROCESSING', 'PAID', 'FAILED', 'HELD');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('TECHNICAL', 'VERIFICATION', 'PAYMENT', 'PAYOUT', 'BOOKING', 'PROFILE', 'ORDER', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'USER_PERMISSION_GRANTED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_PERMISSION_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_PERMISSION_RESET';
ALTER TYPE "AuditAction" ADD VALUE 'EMPLOYEE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'EMPLOYEE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'EMPLOYEE_DEACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'EMPLOYEE_REACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'PANDIT_APPLICATION_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'PANDIT_REVIEW_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'PANDIT_CHANGES_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'PANDIT_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'PANDIT_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'PANDIT_ACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'PANDIT_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE 'PANDIT_SUSPENDED';
ALTER TYPE "AuditAction" ADD VALUE 'PANDIT_REINSTATED';
ALTER TYPE "AuditAction" ADD VALUE 'PANDIT_DOCUMENT_REVIEWED';
ALTER TYPE "AuditAction" ADD VALUE 'PANDIT_DOCUMENT_ACCESSED';
ALTER TYPE "AuditAction" ADD VALUE 'PANDIT_COMMISSION_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'PANDIT_KUNDLI_ACCESS_GRANTED';
ALTER TYPE "AuditAction" ADD VALUE 'PANDIT_KUNDLI_ACCESS_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'PANDIT_KUNDLI_ACCESSED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYOUT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYOUT_PROCESSING';
ALTER TYPE "AuditAction" ADD VALUE 'PAYOUT_PAID';
ALTER TYPE "AuditAction" ADD VALUE 'PAYOUT_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYOUT_HELD';
ALTER TYPE "AuditAction" ADD VALUE 'PAYOUT_RELEASED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYOUT_CONFIG_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'EARNING_ADJUSTED';
ALTER TYPE "AuditAction" ADD VALUE 'TICKET_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE 'TICKET_STATUS_CHANGED';

-- AlterEnum
ALTER TYPE "ProductType" ADD VALUE 'GEMSTONE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'EMPLOYEE';
ALTER TYPE "UserRole" ADD VALUE 'PANDIT';

-- DropForeignKey
ALTER TABLE "Consultation" DROP CONSTRAINT "Consultation_astrologerId_fkey";

-- DropForeignKey
ALTER TABLE "ConsultationSlot" DROP CONSTRAINT "ConsultationSlot_astrologerId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_astrologerId_fkey";

-- DropIndex
DROP INDEX "Consultation_astrologerId_idx";

-- DropIndex
DROP INDEX "ConsultationSlot_astrologerId_startsAt_idx";

-- DropIndex
DROP INDEX "Review_astrologerId_idx";

-- AlterTable
ALTER TABLE "Consultation" DROP COLUMN "astrologerId",
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "durationMinutes" INTEGER NOT NULL,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "grossAmountPaise" INTEGER NOT NULL,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "panditProfileId" TEXT NOT NULL,
ADD COLUMN     "ratePaise" INTEGER NOT NULL,
ADD COLUMN     "rateType" "RateType" NOT NULL,
ADD COLUMN     "scheduledEnd" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "scheduledStart" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
DROP COLUMN "mode",
ADD COLUMN     "mode" "ConsultationMode" NOT NULL;

-- AlterTable
ALTER TABLE "ConsultationSlot" DROP COLUMN "astrologerId",
DROP COLUMN "isBooked",
ADD COLUMN     "panditProfileId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "astrologerId",
ADD COLUMN     "panditProfileId" TEXT;

-- DropTable
DROP TABLE "Astrologer";

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "grantedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanditProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PanditOnboardingStatus" NOT NULL DEFAULT 'REQUESTED',
    "displayName" TEXT NOT NULL DEFAULT '',
    "slug" TEXT,
    "headline" TEXT,
    "bio" TEXT,
    "profileImageUrl" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "yearsOfExperience" INTEGER,
    "languages" TEXT[],
    "expertise" TEXT[],
    "certifications" TEXT[],
    "commissionPercent" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "reviewStartedAt" TIMESTAMP(3),
    "changesRequestedAt" TIMESTAMP(3),
    "changeRequestNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "activatedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectionReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspendedById" TEXT,
    "suspensionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PanditProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanditDocument" (
    "id" TEXT NOT NULL,
    "panditProfileId" TEXT NOT NULL,
    "type" "PanditDocumentType" NOT NULL,
    "status" "PanditDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT,
    "note" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PanditDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanditReview" (
    "id" TEXT NOT NULL,
    "panditProfileId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "decision" "PanditReviewDecision" NOT NULL,
    "fromStatus" "PanditOnboardingStatus" NOT NULL,
    "toStatus" "PanditOnboardingStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PanditReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanditService" (
    "id" TEXT NOT NULL,
    "panditProfileId" TEXT NOT NULL,
    "mode" "ConsultationMode" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rateType" "RateType" NOT NULL DEFAULT 'PER_MINUTE',
    "ratePaise" INTEGER NOT NULL,
    "sessionMinutes" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PanditService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanditScheduleRule" (
    "id" TEXT NOT NULL,
    "panditProfileId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PanditScheduleRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanditScheduleException" (
    "id" TEXT NOT NULL,
    "panditProfileId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PanditScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanditKundliAccess" (
    "id" TEXT NOT NULL,
    "panditProfileId" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "birthProfileId" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PanditKundliAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarningTransaction" (
    "id" TEXT NOT NULL,
    "panditProfileId" TEXT NOT NULL,
    "consultationId" TEXT,
    "payoutId" TEXT,
    "status" "EarningStatus" NOT NULL DEFAULT 'PENDING',
    "grossAmountPaise" INTEGER NOT NULL,
    "commissionPercent" INTEGER NOT NULL,
    "platformCommissionPaise" INTEGER NOT NULL,
    "taxPaise" INTEGER NOT NULL DEFAULT 0,
    "adjustmentPaise" INTEGER NOT NULL DEFAULT 0,
    "netPayablePaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "eligibleAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "heldReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EarningTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "payoutNumber" TEXT NOT NULL,
    "panditProfileId" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "processedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "reference" TEXT,
    "failureReason" TEXT,
    "heldReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutAccount" (
    "id" TEXT NOT NULL,
    "panditProfileId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "bankName" TEXT,
    "accountLast4" TEXT,
    "ifscMasked" TEXT,
    "upiMasked" TEXT,
    "taxIdMasked" TEXT,
    "accountNumberEnvelope" TEXT,
    "ifscEnvelope" TEXT,
    "upiEnvelope" TEXT,
    "taxIdEnvelope" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByRole" "UserRole" NOT NULL,
    "category" "TicketCategory" NOT NULL DEFAULT 'OTHER',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "assignedToId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_permission_key" ON "UserPermission"("userId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_userId_key" ON "EmployeeProfile"("userId");

-- CreateIndex
CREATE INDEX "EmployeeProfile_active_idx" ON "EmployeeProfile"("active");

-- CreateIndex
CREATE UNIQUE INDEX "PanditProfile_userId_key" ON "PanditProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PanditProfile_slug_key" ON "PanditProfile"("slug");

-- CreateIndex
CREATE INDEX "PanditProfile_status_idx" ON "PanditProfile"("status");

-- CreateIndex
CREATE INDEX "PanditDocument_panditProfileId_idx" ON "PanditDocument"("panditProfileId");

-- CreateIndex
CREATE INDEX "PanditDocument_status_idx" ON "PanditDocument"("status");

-- CreateIndex
CREATE INDEX "PanditReview_panditProfileId_createdAt_idx" ON "PanditReview"("panditProfileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PanditService_panditProfileId_mode_key" ON "PanditService"("panditProfileId", "mode");

-- CreateIndex
CREATE INDEX "PanditScheduleRule_panditProfileId_weekday_idx" ON "PanditScheduleRule"("panditProfileId", "weekday");

-- CreateIndex
CREATE INDEX "PanditScheduleException_panditProfileId_date_idx" ON "PanditScheduleException"("panditProfileId", "date");

-- CreateIndex
CREATE INDEX "ChatMessage_consultationId_createdAt_idx" ON "ChatMessage"("consultationId", "createdAt");

-- CreateIndex
CREATE INDEX "PanditKundliAccess_panditProfileId_idx" ON "PanditKundliAccess"("panditProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "PanditKundliAccess_consultationId_calculationId_key" ON "PanditKundliAccess"("consultationId", "calculationId");

-- CreateIndex
CREATE UNIQUE INDEX "EarningTransaction_consultationId_key" ON "EarningTransaction"("consultationId");

-- CreateIndex
CREATE INDEX "EarningTransaction_panditProfileId_status_idx" ON "EarningTransaction"("panditProfileId", "status");

-- CreateIndex
CREATE INDEX "EarningTransaction_payoutId_idx" ON "EarningTransaction"("payoutId");

-- CreateIndex
CREATE INDEX "EarningTransaction_eligibleAt_idx" ON "EarningTransaction"("eligibleAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_payoutNumber_key" ON "Payout"("payoutNumber");

-- CreateIndex
CREATE INDEX "Payout_panditProfileId_status_idx" ON "Payout"("panditProfileId", "status");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutAccount_panditProfileId_key" ON "PayoutAccount"("panditProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_createdById_idx" ON "Ticket"("createdById");

-- CreateIndex
CREATE INDEX "Ticket_assignedToId_idx" ON "Ticket"("assignedToId");

-- CreateIndex
CREATE INDEX "Ticket_category_idx" ON "Ticket"("category");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "Consultation_panditProfileId_idx" ON "Consultation"("panditProfileId");

-- CreateIndex
CREATE INDEX "Consultation_scheduledStart_idx" ON "Consultation"("scheduledStart");

-- CreateIndex
CREATE INDEX "ConsultationSlot_panditProfileId_startsAt_idx" ON "ConsultationSlot"("panditProfileId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationSlot_panditProfileId_startsAt_key" ON "ConsultationSlot"("panditProfileId", "startsAt");

-- CreateIndex
CREATE INDEX "Review_panditProfileId_idx" ON "Review"("panditProfileId");

-- AddForeignKey
ALTER TABLE "ConsultationSlot" ADD CONSTRAINT "ConsultationSlot_panditProfileId_fkey" FOREIGN KEY ("panditProfileId") REFERENCES "PanditProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_panditProfileId_fkey" FOREIGN KEY ("panditProfileId") REFERENCES "PanditProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_panditProfileId_fkey" FOREIGN KEY ("panditProfileId") REFERENCES "PanditProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanditProfile" ADD CONSTRAINT "PanditProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanditProfile" ADD CONSTRAINT "PanditProfile_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanditProfile" ADD CONSTRAINT "PanditProfile_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanditProfile" ADD CONSTRAINT "PanditProfile_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanditProfile" ADD CONSTRAINT "PanditProfile_suspendedById_fkey" FOREIGN KEY ("suspendedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanditDocument" ADD CONSTRAINT "PanditDocument_panditProfileId_fkey" FOREIGN KEY ("panditProfileId") REFERENCES "PanditProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanditDocument" ADD CONSTRAINT "PanditDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanditReview" ADD CONSTRAINT "PanditReview_panditProfileId_fkey" FOREIGN KEY ("panditProfileId") REFERENCES "PanditProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanditReview" ADD CONSTRAINT "PanditReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanditService" ADD CONSTRAINT "PanditService_panditProfileId_fkey" FOREIGN KEY ("panditProfileId") REFERENCES "PanditProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanditScheduleRule" ADD CONSTRAINT "PanditScheduleRule_panditProfileId_fkey" FOREIGN KEY ("panditProfileId") REFERENCES "PanditProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanditScheduleException" ADD CONSTRAINT "PanditScheduleException_panditProfileId_fkey" FOREIGN KEY ("panditProfileId") REFERENCES "PanditProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanditKundliAccess" ADD CONSTRAINT "PanditKundliAccess_panditProfileId_fkey" FOREIGN KEY ("panditProfileId") REFERENCES "PanditProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanditKundliAccess" ADD CONSTRAINT "PanditKundliAccess_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanditKundliAccess" ADD CONSTRAINT "PanditKundliAccess_birthProfileId_fkey" FOREIGN KEY ("birthProfileId") REFERENCES "BirthProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanditKundliAccess" ADD CONSTRAINT "PanditKundliAccess_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "AstrologyCalculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanditKundliAccess" ADD CONSTRAINT "PanditKundliAccess_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningTransaction" ADD CONSTRAINT "EarningTransaction_panditProfileId_fkey" FOREIGN KEY ("panditProfileId") REFERENCES "PanditProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningTransaction" ADD CONSTRAINT "EarningTransaction_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningTransaction" ADD CONSTRAINT "EarningTransaction_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_panditProfileId_fkey" FOREIGN KEY ("panditProfileId") REFERENCES "PanditProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_panditProfileId_fkey" FOREIGN KEY ("panditProfileId") REFERENCES "PanditProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
