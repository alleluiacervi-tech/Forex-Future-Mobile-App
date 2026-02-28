-- Align MarketAlert table with current Prisma schema and recorder payload.
ALTER TABLE "MarketAlert"
  ADD COLUMN IF NOT EXISTS "currentPrice" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "direction" TEXT,
  ADD COLUMN IF NOT EXISTS "velocity" JSONB,
  ADD COLUMN IF NOT EXISTS "confidence" JSONB,
  ADD COLUMN IF NOT EXISTS "levels" JSONB;
