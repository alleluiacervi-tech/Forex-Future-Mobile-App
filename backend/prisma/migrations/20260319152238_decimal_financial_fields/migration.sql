-- AlterTable: Account — Float to Decimal(20,8)
ALTER TABLE "Account" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(20,8) USING "balance"::DECIMAL(20,8);
ALTER TABLE "Account" ALTER COLUMN "equity" SET DATA TYPE DECIMAL(20,8) USING "equity"::DECIMAL(20,8);
ALTER TABLE "Account" ALTER COLUMN "marginUsed" SET DATA TYPE DECIMAL(20,8) USING "marginUsed"::DECIMAL(20,8);

-- AlterTable: Position — Float to Decimal(20,8)
ALTER TABLE "Position" ALTER COLUMN "units" SET DATA TYPE DECIMAL(20,8) USING "units"::DECIMAL(20,8);
ALTER TABLE "Position" ALTER COLUMN "entryPrice" SET DATA TYPE DECIMAL(20,8) USING "entryPrice"::DECIMAL(20,8);
ALTER TABLE "Position" ALTER COLUMN "unrealizedPnl" SET DATA TYPE DECIMAL(20,8) USING "unrealizedPnl"::DECIMAL(20,8);

-- AlterTable: Order — Float to Decimal(20,8)
ALTER TABLE "Order" ALTER COLUMN "units" SET DATA TYPE DECIMAL(20,8) USING "units"::DECIMAL(20,8);
ALTER TABLE "Order" ALTER COLUMN "price" SET DATA TYPE DECIMAL(20,8) USING "price"::DECIMAL(20,8);

-- AlterTable: Transaction — Float to Decimal(20,8)
ALTER TABLE "Transaction" ALTER COLUMN "units" SET DATA TYPE DECIMAL(20,8) USING "units"::DECIMAL(20,8);
ALTER TABLE "Transaction" ALTER COLUMN "price" SET DATA TYPE DECIMAL(20,8) USING "price"::DECIMAL(20,8);
