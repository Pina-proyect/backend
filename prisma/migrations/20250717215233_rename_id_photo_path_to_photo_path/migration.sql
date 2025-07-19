/*
  Warnings:

  - You are about to drop the column `idPhotoPath` on the `Creator` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Creator" DROP COLUMN "idPhotoPath",
ADD COLUMN     "photoPath" TEXT;
