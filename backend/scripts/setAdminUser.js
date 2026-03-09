import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);

const getArgValue = (name) => {
  const index = args.findIndex((arg) => arg === `--${name}`);
  if (index === -1) return undefined;
  return args[index + 1];
};

const emailInput = getArgValue("email") || process.env.ADMIN_EMAIL;
const passwordInput = getArgValue("password") || process.env.ADMIN_PASSWORD;

if (!emailInput || !passwordInput) {
  console.error("Usage: node scripts/setAdminUser.js --email <email> --password <password>");
  process.exit(1);
}

const email = String(emailInput).trim().toLowerCase();
const password = String(passwordInput);
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

try {
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true, email: true },
  });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          email,
          passwordHash,
          isAdmin: true,
          isActive: true,
          emailVerified: true,
          emailVerifiedAt: now,
          trialActive: true,
          trialStartedAt: now,
        },
        select: { id: true, email: true, isAdmin: true, emailVerified: true, trialActive: true },
      })
    : await prisma.user.create({
        data: {
          name: "System Admin",
          email,
          passwordHash,
          isAdmin: true,
          isActive: true,
          emailVerified: true,
          emailVerifiedAt: now,
          baseCurrency: "USD",
          riskLevel: "moderate",
          notifications: true,
          trialActive: true,
          trialStartedAt: now,
        },
        select: { id: true, email: true, isAdmin: true, emailVerified: true, trialActive: true },
      });

  const account = await prisma.account.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!account) {
    await prisma.account.create({
      data: {
        userId: user.id,
        balance: 100000,
        equity: 100000,
        marginUsed: 0,
        currency: "USD",
      },
      select: { id: true },
    });
  }

  const watchlist = await prisma.watchlist.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!watchlist) {
    await prisma.watchlist.create({
      data: {
        userId: user.id,
        pairs: ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD"],
      },
      select: { id: true },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        user,
      },
      null,
      2
    )
  );
} finally {
  await prisma.$disconnect();
}
