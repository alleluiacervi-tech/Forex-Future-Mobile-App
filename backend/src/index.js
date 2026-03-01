import "express-async-errors";
import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import config from "./config.js";
import { connectPrisma } from "./db/prisma.js";
import authRoutes from "./routes/auth.js";
import marketRoutes from "./routes/market.js";
import tradesRoutes from "./routes/trades.js";
import portfolioRoutes from "./routes/portfolio.js";
import usersRoutes from "./routes/users.js";
import emailRoutes from "./routes/email.js";
import adminRoutes from "./routes/admin.js";
import paypalRoutes from "./routes/paypal.js";
import {
  arcjetAdminProtection,
  arcjetApiProtection,
  arcjetAuthProtection,
  arcjetMarketProtection
} from "./middleware/arcjet.js";
import apiResponseMiddleware from "./middleware/apiResponse.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import initializeSocket from "./services/socket.js";
import { logEmailConfigStatus } from "./services/email.js";
import otpService from "./services/otp.js";
import { getLiveRatesFromCache } from "./services/marketCache.js";
import { alertEvents, startMarketRecorder } from "./services/marketRecorder.js";
import { publishMarketAlert } from "./services/marketPubSub.js";
import { shutdownRedis } from "./services/redis.js";
import { appLogger } from "./utils/logger.js";

const app = express();

app.set("trust proxy", config.trustProxy);
app.use(
  pinoHttp({
    logger: appLogger,
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    }
  })
);
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", apiResponseMiddleware);
app.use("/api", arcjetApiProtection);
app.use("/api/auth", arcjetAuthProtection);
app.use("/api/market", arcjetMarketProtection);
app.use("/api/admin", arcjetAdminProtection);

app.get("/api/debug/live", async (_req, res) => {
  const pairs = await getLiveRatesFromCache();
  return res.json({ pairs });
});

app.use("/api/auth", authRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/trades", tradesRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/paypal", paypalRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);
const wss = initializeSocket({ server, heartbeatMs: config.wsHeartbeatMs });

const databaseRequired = process.env.DATABASE_REQUIRED === "true" || config.nodeEnv === "production";
try {
  await connectPrisma({ required: databaseRequired });
} catch (error) {
  appLogger.error({ error: error?.message }, "Database connection failed during startup");
  process.exit(1);
}

startMarketRecorder();
logEmailConfigStatus();

otpService.cleanupExpiredOtps().catch(() => {});
setInterval(() => otpService.cleanupExpiredOtps().catch(() => {}), 15 * 60 * 1000);

alertEvents.on("marketAlert", (alert) => {
  publishMarketAlert(alert);
});

const gracefulShutdown = async (signal) => {
  appLogger.info({ signal }, "Graceful shutdown requested");

  try {
    wss?.closeGracefully?.();
  } catch {}

  try {
    await shutdownRedis();
  } catch {}

  server.close(() => {
    appLogger.info("HTTP server stopped");
  });
};

process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});

server.listen(config.port, "0.0.0.0", () => {
  appLogger.info({ port: config.port }, "Forex backend listening");
});
