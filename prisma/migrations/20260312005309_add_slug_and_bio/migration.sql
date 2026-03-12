/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Creator` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "bio" VARCHAR(255),
ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Creator_slug_key" ON "Creator"("slug");
