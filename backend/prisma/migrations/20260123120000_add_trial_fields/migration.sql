-- AlterTable
ALTER TABLE "User" ADD COLUMN     "trialActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trialStartedAt" TIMESTAMP(3);
