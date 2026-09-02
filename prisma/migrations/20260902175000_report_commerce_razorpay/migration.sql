ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

ALTER TABLE "ReportDefinition"
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "shortDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "priceMinor" INTEGER,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS "estimatedPages" INTEGER,
  ADD COLUMN IF NOT EXISTS "sectionsIncluded" JSONB,
  ADD COLUMN IF NOT EXISTS "requiredInputs" JSONB,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "ReportDefinition"
SET
  "slug" = COALESCE("slug", lower(replace("reportType", '_', '-'))),
  "name" = COALESCE("name", initcap(replace("reportType", '_', ' '))),
  "shortDescription" = COALESCE("shortDescription", 'Personalized astrology report.'),
  "description" = COALESCE("description", 'A structured Vedic astrology interpretation prepared from an immutable Kundli calculation.'),
  "priceMinor" = COALESCE("priceMinor", 49900),
  "estimatedPages" = COALESCE("estimatedPages", 18),
  "sectionsIncluded" = COALESCE("sectionsIncluded", "sections", '[]'::jsonb),
  "requiredInputs" = COALESCE("requiredInputs", "requiredFields", '["birthProfile"]'::jsonb);

ALTER TABLE "ReportDefinition"
  ALTER COLUMN "slug" SET NOT NULL,
  ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "shortDescription" SET NOT NULL,
  ALTER COLUMN "description" SET NOT NULL,
  ALTER COLUMN "priceMinor" SET NOT NULL,
  ALTER COLUMN "estimatedPages" SET NOT NULL,
  ALTER COLUMN "sectionsIncluded" SET NOT NULL,
  ALTER COLUMN "requiredInputs" SET NOT NULL,
  ALTER COLUMN "productId" DROP NOT NULL;

ALTER TABLE "ReportDefinition" DROP CONSTRAINT IF EXISTS "ReportDefinition_productId_fkey";
ALTER TABLE "ReportDefinition"
  ADD CONSTRAINT "ReportDefinition_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReportOrder"
  ADD COLUMN IF NOT EXISTS "astrologyCalculationId" TEXT,
  ADD COLUMN IF NOT EXISTS "priceMinor" INTEGER,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS "reportNameSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "reportSlugSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "priceSnapshot" INTEGER,
  ADD COLUMN IF NOT EXISTS "currencySnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "providerOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

UPDATE "ReportOrder" ro
SET
  "priceMinor" = COALESCE(ro."priceMinor", rd."priceMinor", 49900),
  "currency" = COALESCE(ro."currency", rd."currency", 'INR'),
  "reportNameSnapshot" = COALESCE(ro."reportNameSnapshot", rd."name", 'Astrology Report'),
  "reportSlugSnapshot" = COALESCE(ro."reportSlugSnapshot", rd."slug", 'astrology-report'),
  "priceSnapshot" = COALESCE(ro."priceSnapshot", rd."priceMinor", 49900),
  "currencySnapshot" = COALESCE(ro."currencySnapshot", rd."currency", 'INR')
FROM "ReportDefinition" rd
WHERE ro."reportDefinitionId" = rd."id";

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "reportOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerPaymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "capturedAt" TIMESTAMP(3),
  ALTER COLUMN "orderId" DROP NOT NULL;

UPDATE "Payment" SET "providerPaymentId" = COALESCE("providerPaymentId", "providerRef");

CREATE TABLE IF NOT EXISTS "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReportDefinition_slug_key" ON "ReportDefinition"("slug");

INSERT INTO "ReportDefinition" (
  "id", "slug", "name", "shortDescription", "description", "priceMinor", "currency", "estimatedPages",
  "sectionsIncluded", "requiredInputs", "isActive", "sortOrder", "reportType", "requiredFields", "sections", "samplePages",
  "createdAt", "updatedAt"
) VALUES
  ('report_complete_life', 'complete-life', 'Complete Life Report', 'A broad reading for life themes, strengths, challenges and timing windows.', 'A structured Vedic astrology report covering identity, relationships, career, wealth, health themes, dasha timing and practical astrological guidance. It is interpretive, not a guaranteed prediction.', 149900, 'INR', 32, '["Core chart summary","Personality and strengths","Career direction","Relationships","Wealth themes","Health tendencies","Dasha timing","Remedial guidance"]'::jsonb, '["birthProfile"]'::jsonb, true, 10, 'COMPLETE_LIFE', '["birthProfile"]'::jsonb, '["Core chart summary","Personality and strengths","Career direction","Relationships","Wealth themes","Health tendencies","Dasha timing","Remedial guidance"]'::jsonb, '[]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('report_career', 'career', 'Career Report', 'A focused reading for work style, growth periods and professional decisions.', 'A Vedic astrology interpretation of career inclinations, skill patterns, leadership style, work timing and periods that may need steadier planning. It does not guarantee employment, promotion or income.', 79900, 'INR', 18, '["Career strengths","Work environment","Business vs employment","Growth timing","Caution periods","Practical guidance"]'::jsonb, '["birthProfile"]'::jsonb, true, 20, 'CAREER', '["birthProfile"]'::jsonb, '["Career strengths","Work environment","Business vs employment","Growth timing","Caution periods","Practical guidance"]'::jsonb, '[]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('report_love_marriage', 'love-marriage', 'Love & Marriage Report', 'Relationship patterns, compatibility themes and marriage timing indicators.', 'A relationship-focused astrological interpretation covering emotional style, partnership patterns, marriage indicators and guidance for communication. It is not a substitute for legal, medical or counselling advice.', 89900, 'INR', 20, '["Emotional style","Partnership patterns","Marriage indicators","Compatibility themes","Dasha support","Guidance"]'::jsonb, '["birthProfile"]'::jsonb, true, 30, 'LOVE_MARRIAGE', '["birthProfile"]'::jsonb, '["Emotional style","Partnership patterns","Marriage indicators","Compatibility themes","Dasha support","Guidance"]'::jsonb, '[]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('report_finance', 'finance', 'Finance Report', 'Wealth tendencies, earning style and planning-sensitive periods.', 'A finance-themed astrology interpretation that discusses wealth houses, earning style, risk temperament and timing windows. It is not investment, tax, legal or financial advice.', 79900, 'INR', 18, '["Wealth houses","Income style","Spending patterns","Risk temperament","Timing windows","Planning guidance"]'::jsonb, '["birthProfile"]'::jsonb, true, 40, 'FINANCE', '["birthProfile"]'::jsonb, '["Wealth houses","Income style","Spending patterns","Risk temperament","Timing windows","Planning guidance"]'::jsonb, '[]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('report_year_forecast', 'year-forecast', 'Year Forecast', 'A 12-month astrological overview for priorities, timing and focus areas.', 'A year-ahead interpretation based on the saved birth chart, dasha context and transits prepared as astrological guidance rather than certainty.', 69900, 'INR', 16, '["Year theme","Quarterly focus","Career timing","Relationship timing","Wellbeing themes","Remedies"]'::jsonb, '["birthProfile"]'::jsonb, true, 50, 'YEAR_FORECAST', '["birthProfile"]'::jsonb, '["Year theme","Quarterly focus","Career timing","Relationship timing","Wellbeing themes","Remedies"]'::jsonb, '[]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('report_numerology', 'numerology', 'Numerology Report', 'Name and date based numerology themes prepared as a concise guide.', 'A numerology interpretation for personal themes, favourable patterns and practical guidance. It is a spiritual reading, not a scientific or deterministic forecast.', 49900, 'INR', 12, '["Core numbers","Personality themes","Name vibration","Timing themes","Practical guidance"]'::jsonb, '["birthProfile"]'::jsonb, true, 60, 'NUMEROLOGY', '["birthProfile"]'::jsonb, '["Core numbers","Personality themes","Name vibration","Timing themes","Practical guidance"]'::jsonb, '[]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "shortDescription" = EXCLUDED."shortDescription",
  "description" = EXCLUDED."description",
  "priceMinor" = EXCLUDED."priceMinor",
  "currency" = EXCLUDED."currency",
  "estimatedPages" = EXCLUDED."estimatedPages",
  "sectionsIncluded" = EXCLUDED."sectionsIncluded",
  "requiredInputs" = EXCLUDED."requiredInputs",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder",
  "reportType" = EXCLUDED."reportType",
  "requiredFields" = EXCLUDED."requiredFields",
  "sections" = EXCLUDED."sections",
  "updatedAt" = CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "ReportDefinition_isActive_sortOrder_idx" ON "ReportDefinition"("isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "ReportDefinition_slug_idx" ON "ReportDefinition"("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "ReportOrder_providerOrderId_key" ON "ReportOrder"("providerOrderId");
CREATE INDEX IF NOT EXISTS "ReportOrder_reportDefinitionId_idx" ON "ReportOrder"("reportDefinitionId");
CREATE INDEX IF NOT EXISTS "ReportOrder_birthProfileId_idx" ON "ReportOrder"("birthProfileId");
CREATE INDEX IF NOT EXISTS "ReportOrder_astrologyCalculationId_idx" ON "ReportOrder"("astrologyCalculationId");

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");
CREATE INDEX IF NOT EXISTS "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX IF NOT EXISTS "Payment_reportOrderId_idx" ON "Payment"("reportOrderId");
CREATE INDEX IF NOT EXISTS "Payment_providerOrderId_idx" ON "Payment"("providerOrderId");

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentWebhookEvent_providerEventId_key" ON "PaymentWebhookEvent"("providerEventId");
CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_provider_idx" ON "PaymentWebhookEvent"("provider");
CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_eventType_idx" ON "PaymentWebhookEvent"("eventType");
CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_processedAt_idx" ON "PaymentWebhookEvent"("processedAt");

ALTER TABLE "ReportOrder"
  ALTER COLUMN "priceMinor" SET NOT NULL,
  ALTER COLUMN "reportNameSnapshot" SET NOT NULL,
  ALTER COLUMN "reportSlugSnapshot" SET NOT NULL,
  ALTER COLUMN "priceSnapshot" SET NOT NULL,
  ALTER COLUMN "currencySnapshot" SET NOT NULL;

ALTER TABLE "ReportOrder"
  ADD CONSTRAINT "ReportOrder_astrologyCalculationId_fkey"
  FOREIGN KEY ("astrologyCalculationId") REFERENCES "AstrologyCalculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Payment_reportOrderId_fkey"
  FOREIGN KEY ("reportOrderId") REFERENCES "ReportOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
