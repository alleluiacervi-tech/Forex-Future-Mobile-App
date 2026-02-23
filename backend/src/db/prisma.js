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

  // Prisma 7 expects a driver adapter (or accelerateUrl). If adapter packages
  // are installed, wire PostgreSQL automatically from DATABASE_URL.
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    try {
      const { PrismaPg } = await import("@prisma/adapter-pg");
      prismaOptions.adapter = new PrismaPg({ connectionString });
    } catch {}
  }

  prisma = new PrismaClient({
    ...prismaOptions
  });
} catch (error) {
  prismaInitError = error;
  const reason = error?.message ? String(error.message) : DEFAULT_ERROR_MESSAGE;
  console.warn(`[Prisma] disabled: ${reason}`);
  prisma = createUnavailablePrisma(reason);
}

export const isPrismaAvailable = !prisma.__isUnavailable;
export const getPrismaInitError = () => prismaInitError;
export default prisma;
