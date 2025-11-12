/*
  Warnings:

  - A unique constraint covering the columns `[provider,providerId]` on the table `Creator` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Creator_provider_providerId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Creator_provider_providerId_key" ON "Creator"("provider", "providerId");
