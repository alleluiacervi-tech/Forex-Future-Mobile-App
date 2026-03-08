-- CreateTable
CREATE TABLE "AlertOutcome" (
    "id" TEXT NOT NULL,
    "alertId" TEXT,
    "pair" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "slPrice" DOUBLE PRECISION NOT NULL,
    "tp1Price" DOUBLE PRECISION NOT NULL,
    "tp2Price" DOUBLE PRECISION NOT NULL,
    "tp3Price" DOUBLE PRECISION NOT NULL,
    "outcome" TEXT,
    "exitPrice" DOUBLE PRECISION,
    "exitedAt" TIMESTAMP(3),
    "pnlPips" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertOutcome_pair_outcome_idx" ON "AlertOutcome"("pair", "outcome");

-- CreateIndex
CREATE INDEX "AlertOutcome_createdAt_idx" ON "AlertOutcome"("createdAt");
