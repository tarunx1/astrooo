-- Article publishing: status, cover image, tags, author and SEO overrides.
--
-- Entirely additive. Every new column is nullable or carries a default, so an
-- existing article survives unchanged.
--
-- `status` defaults to DRAFT, which is deliberately the safe direction: an
-- article that existed before this migration becomes invisible rather than
-- being published by accident. Publishing it is then an explicit editorial act.
-- The Article table is empty at the time of writing, so nothing needs
-- republishing here.

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "authorName" TEXT,
ADD COLUMN     "coverImageUrl" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "tags" TEXT[];

-- AlterTable
ALTER TABLE "ArticleCategory" ADD COLUMN     "description" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Article_status_publishedAt_idx" ON "Article"("status", "publishedAt");
