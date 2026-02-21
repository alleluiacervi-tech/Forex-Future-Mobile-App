import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env from process.cwd() first (default), then fall back to backend/.env
dotenv.config();

// Always attempt to load the backend/.env file as a fallback.
// dotenv will not override keys that are already present in process.env.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendEnvPath = path.join(__dirname, "..", ".env");
dotenv.config({ path: backendEnvPath, override: false });

const parseNumber = (value, fallback, { min = null, max = null, integer = false } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  let result = integer ? Math.floor(parsed) : parsed;
  if (min !== null) {
    result = Math.max(min, result);
  }
  if (max !== null) {
    result = Math.min(max, result);
  }

  return result;
};

const parseBoolean = (value, fallback = false) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

const parseCsv = (value) => {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseTrustProxy = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;

  const maybeNumber = Number(normalized);
  if (Number.isInteger(maybeNumber) && maybeNumber >= 0) {
    return maybeNumber;
  }

  return trimmed;
};

const parseArcjetMode = (value, fallback) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "LIVE") return "LIVE";
  if (normalized === "DRY_RUN") return "DRY_RUN";
  return fallback;
};

const defaultArcjetMode = process.env.NODE_ENV === "production" ? "LIVE" : "DRY_RUN";

const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "2h",
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/forex",
  wsHeartbeatMs: Number(process.env.WS_HEARTBEAT_MS || 15000),
  twelveDataApiKey: process.env.TWELVEDATA_API_KEY || "",
  arcjet: {
    enabled: parseBoolean(process.env.ARCJET_ENABLED, true),
    key: String(process.env.ARCJET_KEY || "").trim(),
    mode: parseArcjetMode(process.env.ARCJET_MODE, defaultArcjetMode),
    failClosed: parseBoolean(process.env.ARCJET_FAIL_CLOSED, false),
    trustedProxies: parseCsv(process.env.ARCJET_TRUSTED_PROXIES),
    rateLimits: {
      api: {
        refillRate: parseNumber(process.env.ARCJET_API_REFILL_RATE, 30, { min: 1, integer: true }),
        interval: parseNumber(process.env.ARCJET_API_INTERVAL_SECONDS, 10, { min: 1, integer: true }),
        capacity: parseNumber(process.env.ARCJET_API_CAPACITY, 60, { min: 1, integer: true })
      },
      auth: {
        refillRate: parseNumber(process.env.ARCJET_AUTH_REFILL_RATE, 2, { min: 1, integer: true }),
        interval: parseNumber(process.env.ARCJET_AUTH_INTERVAL_SECONDS, 60, { min: 1, integer: true }),
        capacity: parseNumber(process.env.ARCJET_AUTH_CAPACITY, 8, { min: 1, integer: true })
      },
      admin: {
        refillRate: parseNumber(process.env.ARCJET_ADMIN_REFILL_RATE, 5, { min: 1, integer: true }),
        interval: parseNumber(process.env.ARCJET_ADMIN_INTERVAL_SECONDS, 60, { min: 1, integer: true }),
        capacity: parseNumber(process.env.ARCJET_ADMIN_CAPACITY, 20, { min: 1, integer: true })
      }
    }
  }
};

export default config;
