-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "status" TEXT NOT NULL DEFAULT 'requested',
    "destinationPlatform" TEXT NOT NULL DEFAULT 'mercadopago',
    "destinationReference" TEXT,
    "evidence" VARCHAR(500),
    "clientRequestId" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Withdrawal_creatorId_status_idx" ON "Withdrawal"("creatorId", "status");

-- CreateIndex
CREATE INDEX "Withdrawal_creatorId_createdAt_idx" ON "Withdrawal"("creatorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_creatorId_clientRequestId_key" ON "Withdrawal"("creatorId", "clientRequestId");

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
