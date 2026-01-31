import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env from process.cwd() first (default), then fall back to backend/.env
dotenv.config();

// If important keys aren't present, attempt to load the backend/.env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendEnvPath = path.join(__dirname, "..", ".env");
if (!process.env.GROQ_API_KEY) {
  dotenv.config({ path: backendEnvPath });
}

const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "2h",
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/forex",
  wsHeartbeatMs: Number(process.env.WS_HEARTBEAT_MS || 15000),
  groqApiKey: process.env.GROQ_API_KEY || "",
  twelveDataApiKey: process.env.TWELVEDATA_API_KEY || ""
};

export default config;
