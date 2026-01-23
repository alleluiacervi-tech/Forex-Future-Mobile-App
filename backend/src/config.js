import dotenv from "dotenv";

dotenv.config();

const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "2h",
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/forex",
  wsHeartbeatMs: Number(process.env.WS_HEARTBEAT_MS || 15000),
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  twelveDataApiKey: process.env.TWELVEDATA_API_KEY || ""
};

export default config;
