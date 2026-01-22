import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const main = async () => {
  const existing = await prisma.user.findUnique({ where: { email: "demo@forex.app" } });
  if (existing) {
    return;
  }

  const passwordHash = await bcrypt.hash("demo1234", 10);

  const user = await prisma.user.create({
    data: {
      name: "Demo Trader",
      email: "demo@forex.app",
      passwordHash,
      baseCurrency: "USD",
      riskLevel: "moderate",
      notifications: true,
      account: {
        create: {
          balance: 100000,
          equity: 100000,
          marginUsed: 0,
          currency: "USD"
        }
      },
      watchlist: {
        create: {
          pairs: ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD"]
        }
      }
    }
  });

  await prisma.transaction.create({
    data: {
      userId: user.id,
      type: "deposit",
      price: 0,
      units: 0
    }
  });
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
