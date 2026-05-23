-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "instagram" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "niche" TEXT,
ADD COLUMN     "tiktok" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "youtube" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
