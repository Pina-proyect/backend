-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "country" TEXT,
ADD COLUMN     "donationGoalAmount" DOUBLE PRECISION,
ADD COLUMN     "donationGoalTitle" VARCHAR(100),
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gender" TEXT NOT NULL DEFAULT 'creadora',
ADD COLUMN     "mpAccessToken" TEXT,
ADD COLUMN     "mpPublicKey" TEXT,
ADD COLUMN     "mpRefreshToken" TEXT,
ADD COLUMN     "pinaPrice" DOUBLE PRECISION NOT NULL DEFAULT 1000,
ADD COLUMN     "verificationToken" TEXT,
ADD COLUMN     "verificationTokenExpires" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "message" VARCHAR(500),
    "donorName" TEXT,
    "donorId" TEXT,
    "creatorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Creator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
