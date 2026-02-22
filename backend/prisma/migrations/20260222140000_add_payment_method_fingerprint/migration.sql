-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN "fingerprint" TEXT;

-- CreateIndex
CREATE INDEX "PaymentMethod_fingerprint_idx" ON "PaymentMethod"("fingerprint");
