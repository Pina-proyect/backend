-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "aiLastAnalyzedAt" TIMESTAMP(3),
ADD COLUMN     "aiPlanAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiSuggestedBio" VARCHAR(255),
ADD COLUMN     "aiSuggestedGoal" JSONB,
ADD COLUMN     "aiSuggestedNiche" TEXT,
ADD COLUMN     "aiSuggestedPlan" TEXT,
ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "socialLinks" JSONB;

-- CreateTable
CREATE TABLE "CreatorInsight" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "case" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorInsight_creatorId_createdAt_idx" ON "CreatorInsight"("creatorId", "createdAt");

-- AddForeignKey
ALTER TABLE "CreatorInsight" ADD CONSTRAINT "CreatorInsight_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
