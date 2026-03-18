-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminCreated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedBy" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedBy" TEXT,
ADD COLUMN     "suspendedReason" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "discountPercent" INTEGER,
ADD COLUMN     "discountReason" TEXT,
ADD COLUMN     "discount_applied_at" TIMESTAMP(3),
ADD COLUMN     "discount_applied_by" TEXT,
ADD COLUMN     "is_free" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overridden_by" TEXT,
ADD COLUMN     "override_reason" TEXT,
ADD COLUMN     "trial_extend_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trial_extended_at" TIMESTAMP(3),
ADD COLUMN     "trial_extended_by" TEXT;

-- CreateTable
CREATE TABLE "AdminAction" (
    "id" SERIAL NOT NULL,
    "adminId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "actionType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAction_adminId_idx" ON "AdminAction"("adminId");

-- CreateIndex
CREATE INDEX "AdminAction_targetUserId_idx" ON "AdminAction"("targetUserId");

-- CreateIndex
CREATE INDEX "AdminAction_actionType_idx" ON "AdminAction"("actionType");

-- CreateIndex
CREATE INDEX "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");

-- AddForeignKey
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
