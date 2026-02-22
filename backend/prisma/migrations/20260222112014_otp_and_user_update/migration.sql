/*
  Warnings:

  - You are about to drop the column `emailVerificationCodeHash` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerificationExpiresAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerificationSentAt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailVerificationCodeHash",
DROP COLUMN "emailVerificationExpiresAt",
DROP COLUMN "emailVerificationSentAt";

-- CreateTable
CREATE TABLE "Otp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Otp_userId_purpose_idx" ON "Otp"("userId", "purpose");

-- CreateIndex
CREATE INDEX "Otp_expiresAt_idx" ON "Otp"("expiresAt");

-- AddForeignKey
ALTER TABLE "Otp" ADD CONSTRAINT "Otp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
