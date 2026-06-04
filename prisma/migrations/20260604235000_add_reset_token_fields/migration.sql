-- AlterTable
ALTER TABLE "Creator" ADD COLUMN "resetToken" TEXT,
ADD COLUMN "resetTokenExpires" TIMESTAMP(3);
