import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import config from "./config.js";
import authRoutes from "./routes/auth.js";
import marketRoutes from "./routes/market.js";
import tradesRoutes from "./routes/trades.js";
import portfolioRoutes from "./routes/portfolio.js";
import usersRoutes from "./routes/users.js";
import emailRoutes from "./routes/email.js";
import initializeSocket from "./services/socket.js";
import { logEmailConfigStatus } from "./services/email.js";
import { getLiveRatesFromCache } from "./services/marketCache.js";
import { startMarketRecorder } from "./services/marketRecorder.js";

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Debug: expose live rates from in-memory cache
app.get("/api/debug/live", (req, res) => {
  try {
    const pairs = getLiveRatesFromCache();
    return res.json({ pairs });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/trades", tradesRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/email", emailRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

const server = http.createServer(app);

initializeSocket({ server, heartbeatMs: config.wsHeartbeatMs });

startMarketRecorder();

logEmailConfigStatus();

server.listen(config.port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`Forex backend listening on port ${config.port}`);
});
