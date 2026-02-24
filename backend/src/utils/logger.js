import fs from "fs";
import path from "path";
import pino from "pino";

const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const normalizeLevel = (value, fallback) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["fatal", "error", "warn", "info", "debug", "trace", "silent"].includes(normalized)) {
    return normalized;
  }
  return fallback;
};

const appLevel = normalizeLevel(
  process.env.LOG_LEVEL,
  process.env.NODE_ENV === "production" ? "info" : "debug"
);

const stream = pino.multistream([
  { level: appLevel, stream: pino.destination(1) },
  { level: "info", stream: pino.destination({ dest: path.join(logsDir, "app.log"), sync: false }) },
  { level: "warn", stream: pino.destination({ dest: path.join(logsDir, "error.log"), sync: false }) }
]);

const rootLogger = pino(
  {
    level: appLevel,
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: "forex-backend",
      env: process.env.NODE_ENV || "development"
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
        "req.body.cardNumber",
        "req.body.cardCvc",
        "req.body.token"
      ],
      remove: true
    }
  },
  stream
);

const normalizeMeta = (meta) => {
  if (meta === null || meta === undefined) return {};
  if (meta instanceof Error) {
    return {
      error: {
        name: meta.name,
        message: meta.message,
        stack: meta.stack
      }
    };
  }
  if (typeof meta === "object") return meta;
  return { meta };
};

class Logger {
  constructor(name = "App") {
    this.logger = rootLogger.child({ component: name });
  }

  info(message, meta) {
    this.logger.info(normalizeMeta(meta), message);
  }

  error(message, meta) {
    this.logger.error(normalizeMeta(meta), message);
  }

  warn(message, meta) {
    this.logger.warn(normalizeMeta(meta), message);
  }

  debug(message, meta) {
    this.logger.debug(normalizeMeta(meta), message);
  }

  trace(message, meta) {
    this.logger.trace(normalizeMeta(meta), message);
  }

  child(bindings = {}) {
    const childLogger = Object.create(Logger.prototype);
    childLogger.logger = this.logger.child(bindings);
    return childLogger;
  }
}

export const appLogger = rootLogger;
export const getLogger = (name) => new Logger(name);

export default Logger;
