import Logger from "../utils/logger.js";
import config from "../config.js";

const logger = new Logger("Prisma");

const DEFAULT_ERROR_MESSAGE =
  "Database client is unavailable. Prisma initialization failed; install compatible Prisma dependencies or provide a Prisma 7 adapter.";

const createUnavailablePrisma = (reasonMessage = DEFAULT_ERROR_MESSAGE) => {
  const unavailableError = () => new Error(reasonMessage);
  const unavailableCall = async () => {
    throw unavailableError();
  };

  const modelProxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return undefined;
        return unavailableCall;
      }
    }
  );

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "__isUnavailable") return true;
        if (prop === "__reason") return reasonMessage;
        if (prop === "$connect" || prop === "$disconnect") return async () => {};
        if (prop === "$transaction") return unavailableCall;
        if (prop === "marketAlert" || prop === "marketCandle") return undefined;
        if (typeof prop === "symbol") return undefined;
        return modelProxy;
      }
    }
  );
};

let prisma;
let prismaInitError = null;

try {
  const { PrismaClient } = await import("@prisma/client");
  const prismaOptions = {
    log: ["error", "warn"]
  };

  // Prisma 7 expects a driver adapter (or accelerateUrl). Resolve DATABASE_URL
  // from runtime env first, then fall back to app config defaults.
  const connectionString = String(process.env.DATABASE_URL || config.databaseUrl || "").trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured. Database-backed persistence is unavailable.");
  }

  try {
    const { PrismaPg } = await import("@prisma/adapter-pg");
    prismaOptions.adapter = new PrismaPg({ connectionString });
  } catch (error) {
    throw new Error(
      `Failed to initialize Prisma PostgreSQL adapter (@prisma/adapter-pg): ${error?.message || "unknown error"}`
    );
  }

  prisma = new PrismaClient({
    ...prismaOptions
  });
} catch (error) {
  prismaInitError = error;
  const reason = error?.message ? String(error.message) : DEFAULT_ERROR_MESSAGE;
  logger.warn("Prisma client disabled", { reason });
  prisma = createUnavailablePrisma(reason);
}

export const isPrismaAvailable = !prisma.__isUnavailable;
export const getPrismaInitError = () => prismaInitError;

export const connectPrisma = async ({ required = false } = {}) => {
  if (!isPrismaAvailable) {
    const reason = prisma?.__reason || DEFAULT_ERROR_MESSAGE;
    if (required) {
      throw new Error(reason);
    }
    logger.warn("Prisma unavailable; continuing with degraded persistence mode.", { reason });
    return false;
  }

  try {
    await prisma.$connect();
    return true;
  } catch (error) {
    if (required) {
      throw error;
    }
    logger.warn("Prisma connection failed; continuing with degraded persistence mode.", {
      error: error?.message
    });
    return false;
  }
};

export default prisma;
