-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "selfiePath" TEXT,
    "idPhotoPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Creator_email_key" ON "Creator"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_nationalId_key" ON "Creator"("nationalId");
