import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import prisma from "../db/prisma.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..", "..");

const REQUIRED_TABLES = ["subscriptions", "payment_events", "trial_fingerprints"];

const runPrismaDeploy = () => {
  execSync("npx prisma migrate deploy", {
    cwd: backendRoot,
    stdio: "inherit",
  });
};

const assertTables = async () => {
  const result = await prisma.$queryRaw`
    SELECT table_name::text
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY(${REQUIRED_TABLES}::text[])
  `;

  const found = new Set(result.map((row) => row.table_name));
  const missing = REQUIRED_TABLES.filter((name) => !found.has(name));
  if (missing.length > 0) {
    throw new Error(`Missing required tables: ${missing.join(", ")}`);
  }
};

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  runPrismaDeploy();
  await assertTables();
  console.log("Database migration completed and verified.");
  await prisma.$disconnect();
};

main().catch(async (error) => {
  console.error("Migration failed:", error?.message || error);
  await prisma.$disconnect();
  process.exit(1);
});
