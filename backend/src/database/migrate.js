import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import dotenv from "dotenv";

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
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const result = await pool.query(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])
      `,
      [REQUIRED_TABLES]
    );

    const found = new Set(result.rows.map((row) => row.table_name));
    const missing = REQUIRED_TABLES.filter((name) => !found.has(name));
    if (missing.length > 0) {
      throw new Error(`Missing required tables: ${missing.join(", ")}`);
    }
  } finally {
    await pool.end();
  }
};

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  runPrismaDeploy();
  await assertTables();
  console.log("Database migration completed and verified.");
};

main().catch((error) => {
  console.error("Migration failed:", error?.message || error);
  process.exit(1);
});
