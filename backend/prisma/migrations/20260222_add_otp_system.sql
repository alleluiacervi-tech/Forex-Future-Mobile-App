-- Migration: Add OTP system
-- Created: 2026-02-22
-- Purpose: Replace token-based email verification with OTP

-- Add OTP table
CREATE TABLE "Otp" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "ip" TEXT,
  "deviceInfo" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Otp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX "Otp_userId_purpose_idx" ON "Otp"("userId", "purpose");
CREATE INDEX "Otp_expiresAt_idx" ON "Otp"("expiresAt");

-- Drop legacy email verification columns from User table
-- Note: This assumes the columns were added in a previous migration
-- Adjust column names/table based on your actual schema
-- ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerificationCodeHash";
-- ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerificationExpiresAt";
-- ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerificationSentAt";

-- Note: PaymentMethod already supports token field via Stripe integration
-- No changes needed if existing schema includes:
-- - token (unique, optional)
-- - brand, last4, expMonth, expYear

