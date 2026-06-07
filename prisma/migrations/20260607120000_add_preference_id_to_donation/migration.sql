-- AlterTable
ALTER TABLE "Donation" ADD COLUMN "preferenceId" TEXT,
ADD COLUMN "preferenceCreatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Donation_preferenceId_key" ON "Donation"("preferenceId");
